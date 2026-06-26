import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// WATCHABLE demo of the subscription money rail (run headed): the SAME assertions as
// e2e/subscription-enforcement.spec.ts, but paced with captions so a human can watch the
// lapsed operator's /[slug] page go LIVE → CLOSED (404) → LIVE again on renewal.
//
//   DEMO=1 npx playwright test e2e/scenario-demo.spec.ts --headed --workers=1
//
// Skipped by default so the normal `npm run test:e2e` ignores it (no slow pauses in CI).

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
  await admin.from("billing_config").update({ enforcement_mode: mode }).eq("id", true);
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe.serial("WATCH: subscription enforcement on the booking page", () => {
  test.skip(!process.env.DEMO, "headed demo only — run with DEMO=1 ... --headed");
  test.setTimeout(120_000);

  const run = Date.now();
  const slug = `demo-lapse-${run}`;
  const propertyName = `Demo Surf House`;
  let userId: string;
  let tenantId: string;

  // Caption banner injected on top of the real page so you can read what each state means.
  async function caption(page: import("@playwright/test").Page, text: string, color: string) {
    await page.evaluate(
      ({ text, color }) => {
        let el = document.getElementById("__demo_banner");
        if (!el) {
          el = document.createElement("div");
          el.id = "__demo_banner";
          document.body.appendChild(el);
        }
        el.textContent = text;
        el.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:16px;
          font:700 20px system-ui,sans-serif;color:#fff;background:${color};text-align:center;
          box-shadow:0 4px 16px rgba(0,0,0,.25)`;
      },
      { text, color },
    );
  }

  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `demo-lapse-${run}@example.com`,
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
    tenantId = tenant!.id as string;

    // An approved operator who PAID for Pro (so the page starts live).
    await admin
      .from("tenants")
      .update({
        verification_status: "approved",
        plan: "pro",
        subscription_status: "active",
        paid_until: isoDate(20),
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
    await setMode("enforce"); // enforcement is ON the whole time (post-pilot world)
  });

  test.afterAll(async () => {
    await setMode("off");
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  test("live → closed → reopened", async ({ page }) => {
    // 1) PAID → page is live, guests can book.
    let resp = await page.goto(`/${slug}`);
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
    await caption(page, "① PAID — booking page is LIVE, guests can book", "#0a7d34");
    await pause(4000);

    // 2) Operator stops paying past the grace window → lapsed.
    await admin
      .from("tenants")
      .update({ subscription_status: "past_due", paid_until: isoDate(-10) })
      .eq("id", tenantId);
    await caption(page, "② Operator stopped paying (lapsed past the 3-day grace)…", "#b45309");
    await pause(2500);

    // 3) Reload → the page is CLOSED (404). The exploit ("free forever") is shut.
    resp = await page.goto(`/${slug}`);
    expect(resp?.status()).toBe(404);
    await expect(page.getByText(/we couldn.?t find that page/i)).toBeVisible();
    await caption(page, "③ LAPSED — page CLOSED (404). No new bookings, any path.", "#b91c1c");
    await pause(4500);

    // 4) Renewal → reopens immediately (no cron needed — live evaluation).
    await admin.rpc("admin_mark_subscription_paid", {
      p_tenant_id: tenantId,
      p_paid_until: isoDate(25),
    });
    await caption(page, "④ Operator renews…", "#1d4ed8");
    await pause(2000);

    resp = await page.goto(`/${slug}`);
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
    await caption(page, "⑤ RENEWED — page is LIVE again, instantly", "#0a7d34");
    await pause(5000);
  });
});
