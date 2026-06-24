// @vitest-environment node
//
// Discovery-gate guard — proves the marketplace GRID is a paid perk while the operator's own page
// stays public regardless of plan. After 20260624120100_marketplace_paid_only:
//   - list_public_listings() (the grid) EXCLUDES Free (plan <> 'free') and emits `featured`.
//   - get_public_listing(slug) (the /[slug] page) is UNCHANGED — a Free operator still resolves.
// This pins the deliberate divergence between the two. INTEGRATION test: requires the local Supabase
// stack + .env.local/.env.development (same recipe as tests/tenant-plan-lockdown.test.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

function loadEnvFile(file: string): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // file may be absent; env may already be set by the shell/CI
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
const admin: SupabaseClient = createClient(url, secretKey, noPersist);
// The grid + listing RPCs are the PUBLIC read path: execute is granted to anon/authenticated only
// (revoked from public/service-role), so we exercise them through an anon client — exactly how a
// guest hits them.
const anon: SupabaseClient = createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];

type GridRow = { slug: string; featured: boolean };

async function grid(): Promise<GridRow[]> {
  const { data, error } = await anon.rpc("list_public_listings");
  if (error) throw error;
  return (data ?? []) as GridRow[];
}

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("marketplace discovery gate", () => {
  let tenantId: string;
  let slug: string;

  beforeAll(async () => {
    const email = `discovery-gate-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "test-password-123456",
      email_confirm: true,
    });
    if (error) throw error;
    createdUserIds.push(data.user!.id);

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .select("id")
      .eq("user_id", data.user!.id)
      .single();
    if (tErr) throw tErr;
    tenantId = tenant!.id as string;

    // Make the tenant publicly visible (approved) and give it a property with a unique slug.
    await admin.from("tenants").update({ verification_status: "approved" }).eq("id", tenantId);
    slug = `gate-${Date.now()}`;
    const { error: pErr } = await admin
      .from("properties")
      .insert({ tenant_id: tenantId, name: "Gate Test Stay", slug, area: "Urbiztondo" });
    if (pErr) throw pErr;
  });

  it("lists an approved Solo operator on the grid, not featured while trialing", async () => {
    const row = (await grid()).find((r) => r.slug === slug);
    expect(row).toBeDefined();
    expect(row!.featured).toBe(false); // Solo + trialing → listed but unboosted
  });

  it("features an actively-paying Pro operator on the grid", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await admin
      .from("tenants")
      .update({ plan: "pro", subscription_status: "active", paid_until: tomorrow })
      .eq("id", tenantId);

    const row = (await grid()).find((r) => r.slug === slug);
    expect(row).toBeDefined();
    expect(row!.featured).toBe(true);
  });

  it("drops a Free operator from the grid but keeps its /[slug] page resolvable", async () => {
    await admin
      .from("tenants")
      .update({ plan: "free", subscription_status: "trialing", paid_until: null })
      .eq("id", tenantId);

    // Absent from the grid (discovery is a paid perk)...
    expect((await grid()).some((r) => r.slug === slug)).toBe(false);

    // ...but the operator's own page still resolves (their FB funnel keeps working).
    const { data, error } = await anon.rpc("get_public_listing", { p_slug: slug });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as { property: { slug: string } }).property.slug).toBe(slug);
  });
});
