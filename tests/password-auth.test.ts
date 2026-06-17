// @vitest-environment node
//
// Email + password auth (Supabase-native). Verifies a guest can self-serve an
// operator account with a password — and that the handle_new_user trigger still
// provisions a tenant for a password signup, exactly as it does for magic link.
// INTEGRATION test: needs the local Supabase stack (see tests/tenant-isolation.test.ts).
// NOTE: relies on the project's email confirmation being OFF (local config.toml
// `enable_confirmations = false`) so signUp returns a session immediately.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterAll } from "vitest";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // env may already be set by the shell/CI
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;
const admin = createClient(url, secretKey, noPersist);
const anon = (): SupabaseClient => createClient(url, publishableKey, noPersist);

const createdUserIds: string[] = [];
afterAll(async () => {
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
});

describe("email + password auth (Supabase-native)", () => {
  const password = "test-password-123456";

  it("signs up with a password → session + auto-provisioned tenant", async () => {
    const email = `pw-${Date.now()}@example.com`;
    const { data, error } = await anon().auth.signUp({ email, password });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull(); // confirmations off locally
    expect(data.user).not.toBeNull();
    createdUserIds.push(data.user!.id);

    // handle_new_user provisions the tenant for a password signup, same as magic link.
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("user_id", data.user!.id)
      .single();
    expect(tenant?.id).toBeTruthy();
  });

  it("signs in with the right password, rejects the wrong one", async () => {
    const email = `pw-signin-${Date.now()}@example.com`;
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    createdUserIds.push(created.user!.id);

    const ok = await anon().auth.signInWithPassword({ email, password });
    expect(ok.error).toBeNull();
    expect(ok.data.session).not.toBeNull();

    const bad = await anon().auth.signInWithPassword({ email, password: "wrong-password-000" });
    expect(bad.error).not.toBeNull();
  });
});
