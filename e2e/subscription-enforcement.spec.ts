import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// E2E for the subscription money rail, in the real browser against the dev server + local Supabase.
// Tells the user-facing half of the "buy one month of Pro, then go free forever" story:
//   dormant (mode off) → the lapsed operator's /[slug] page is LIVE
//   enforced + lapsed   → the page is CLOSED (404), so guests cannot book
//   renewed             → the page is LIVE again, immediately
// Serial: it flips the single global billing_config row, so the steps must not run in parallel.

function loadEnvFile(file: string): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // env may already be set by the shell/CI
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const setMode = async (mode: "off" | "dry_run" | "enforce") => {
  const { error } = await admin
    .from("billing_config")
    .update({ enforcement_mode: mode })
    .eq("id", true);
  if (error) throw error;
};

test.describe.serial("subscription enforcement — guest-facing booking page", () => {
  const run = Date.now();
  const slug = `e2e-lapse-${run}`;
  const propertyName = `E2E Lapse Inn ${run}`;
  let userId: string;

  test.beforeAll(async () => {
    // Seed an APPROVED operator who paid for Pro but has since lapsed past the grace window.
    const { data, error } = await admin.auth.admin.createUser({
      email: `e2e-lapse-${run}@example.com`,
      password: "test-password-123456",
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;

    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("user_id", userId)
      .single();
    const tenantId = tenant!.id as string;

    await admin
      .from("tenants")
      .update({
        verification_status: "approved",
        plan: "pro",
        subscription_status: "past_due",
        paid_until: isoDate(-10), // lapsed 10 days ago → past the 3-day grace
      })
      .eq("id", tenantId);

    const { data: property } = await admin
      .from("properties")
      .insert({ tenant_id: tenantId, name: propertyName, slug })
      .select("id")
      .single();
    await admin.from("room_types").insert({
      tenant_id: tenantId,
      property_id: property!.id,
      name: "Ocean Loft",
      capacity: 4,
      quantity: 3,
      base_price: 2500,
    });

    await setMode("off"); // start dormant
  });

  test.afterAll(async () => {
    await setMode("off");
    if (userId) await admin.auth.admin.deleteUser(userId); // cascades all seeded data
  });

  test("dormant (mode=off): the lapsed operator's page is live and bookable", async ({ page }) => {
    test.slow(); // first dev compile of the [slug] route can be slow
    await setMode("off");

    const resp = await page.goto(`/${slug}`);
    expect(resp?.status()).toBe(200);
    // The property's booking page renders (its name is the page <h1>) → guests can book.
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
  });

  test("enforced + lapsed: the page is CLOSED — guests get a 404, cannot book", async ({
    page,
  }) => {
    test.slow();
    await setMode("enforce");

    const resp = await page.goto(`/${slug}`);
    expect(resp?.status()).toBe(404);
    await expect(page.getByText(/we couldn.?t find that page/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: propertyName })).toHaveCount(0);
  });

  test("renewed: the page reopens immediately (live evaluation, no cron)", async ({ page }) => {
    test.slow();
    // Admin reconciles the payment (or the webhook lands) → paid_until advances → page reopens.
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("user_id", userId)
      .single();
    const fix = await admin.rpc("admin_mark_subscription_paid", {
      p_tenant_id: tenant!.id,
      p_paid_until: isoDate(25),
    });
    expect(fix.error).toBeNull();

    // Enforcement is still ON — but they're paid again, so the page is live.
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();

    await setMode("off");
  });
});
