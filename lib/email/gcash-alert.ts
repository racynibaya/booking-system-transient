import "server-only";

import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { row, shell } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/server";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

// Email admins when a live (approved) operator changes a payout method, so they can re-verify
// within the 3-day grace window before the public gate auto-pauses the listing. Best-effort; never
// throws (mirrors sendEmail). Recipients come from a service-role RPC so operator sessions can't
// enumerate admin emails.
export async function notifyAdminsPayoutChanged(opts: {
  operatorName: string | null;
  operatorEmail: string | null;
}): Promise<void> {
  try {
    // Prefer the configured admin email(s); fall back to is_admin operators. Env-first means
    // alerts work even before anyone is granted is_admin in the DB.
    let recipients = (env.ADMIN_ALERT_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      const admin = createServiceClient();
      const { data } = await admin.rpc("admin_notification_recipients");
      recipients = (data ?? [])
        .map((r) => r.email)
        .filter((e): e is string => typeof e === "string" && e.length > 0);
    }
    if (recipients.length === 0) return;

    const who = opts.operatorName ?? opts.operatorEmail ?? "An operator";
    const subject = `Payout changed: ${who} — review within 3 days`;
    const html = shell(
      "Payout method changed",
      `${escapeHtml(who)} just changed a payout method on Tuloy. Their booking page stays live for 3 days, then pauses until you confirm the payout account name matches their ID.`,
      row("Operator", escapeHtml(who)) + row("Email", escapeHtml(opts.operatorEmail ?? "—")),
      `Review in <a href="https://tuloysanjuan.com/admin/operators" style="color:#2c7a6b">Admin → Operators</a>.`,
    );
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })));
  } catch (err) {
    console.error("[gcash-alert] failed", err);
  }
}
