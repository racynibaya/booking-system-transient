import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";

// F0.1 happy-path E2E. Runs against the LOCAL Supabase stack only — it reads the
// magic-link email out of Mailpit, which is a local-dev feature (cloud sends real
// email). Boot the app pointed at local Supabase, e.g.:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable> \
//   SUPABASE_SECRET_KEY=<local secret> npx playwright test e2e/auth-magic-link.spec.ts

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";
const MAILPIT_URL = "http://127.0.0.1:54324";

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Poll Mailpit for the most recent message to `email` and return its /auth/confirm link.
async function getMagicLink(api: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await api.get(`${MAILPIT_URL}/api/v1/messages`);
    if (res.ok()) {
      const { messages } = (await res.json()) as {
        messages: { ID: string; To: { Address: string }[] }[];
      };
      const msg = messages.find((m) => m.To.some((t) => t.Address === email));
      if (msg) {
        const detail = await api.get(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
        const body = (await detail.json()) as { HTML?: string; Text?: string };
        const html = body.HTML ?? body.Text ?? "";
        const match = html.match(/https?:\/\/[^"'\s<]*\/auth\/confirm\?[^"'\s<]*/);
        if (match) return match[0].replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No magic-link email arrived for ${email}`);
}

test("operator signs in via magic link and lands on their dashboard", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Request a magic link from the login page.
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: /send magic link/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  // 2. Open the link Supabase emailed (captured by Mailpit).
  const link = await getMagicLink(request, email);
  await page.goto(link);

  // 3. Land authenticated on the tenant-scoped dashboard.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();

  // Cleanup: delete the user (cascades to their tenants row).
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
});
