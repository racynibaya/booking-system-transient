// @vitest-environment node
//
// F0.1 acceptance — tenant isolation is a database guarantee (architecture P2).
// This is an INTEGRATION test: it requires the local Supabase stack running
// (`npx supabase start`) and `.env.local` populated from `npx supabase status`.
// It creates two real auth users and asserts that, under RLS, neither operator
// can ever read or take over the other's tenant row.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Vitest only exposes VITE_-prefixed vars; load the Supabase keys ourselves.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local absent — env may already be set by the shell/CI.
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
const admin = createClient(url, secretKey, noPersist);

type Operator = { userId: string; client: SupabaseClient };

// Create a confirmed operator and return a client authenticated as them. We use a
// password here only so the test can mint a session; production sign-in is magic
// link (B5). RLS sees the same `authenticated` JWT either way.
async function makeOperator(email: string): Promise<Operator> {
  const password = "test-password-123456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user!.id;

  const client = createClient(url, publishableKey, noPersist);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId, client };
}

describe("tenant isolation (RLS on public.tenants)", () => {
  const run = Date.now();
  let a: Operator;
  let b: Operator;

  beforeAll(async () => {
    a = await makeOperator(`op-a-${run}@example.com`);
    b = await makeOperator(`op-b-${run}@example.com`);
  });

  afterAll(async () => {
    if (a) await admin.auth.admin.deleteUser(a.userId); // cascades to tenants
    if (b) await admin.auth.admin.deleteUser(b.userId);
  });

  it("provisions exactly one tenant row per signup (handle_new_user trigger, B6)", async () => {
    const { data, error } = await admin
      .from("tenants")
      .select("id,user_id")
      .in("user_id", [a.userId, b.userId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("an operator reads only their own tenant row", async () => {
    const { data, error } = await a.client.from("tenants").select("id,user_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(a.userId);
  });

  it("an operator cannot read another operator's tenant row", async () => {
    // Even explicitly filtering for B's row, A gets nothing — RLS denies the read.
    const { data, error } = await a.client
      .from("tenants")
      .select("id,user_id")
      .eq("user_id", b.userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("an operator cannot reassign their tenant to another user (UPDATE WITH CHECK)", async () => {
    const { error } = await a.client
      .from("tenants")
      .update({ user_id: b.userId })
      .eq("user_id", a.userId)
      .select();
    // WITH CHECK rejects the new row state; the write fails rather than silently leaking.
    expect(error).not.toBeNull();
  });
});
