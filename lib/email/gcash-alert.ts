import "server-only";

import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/server";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

// Email admins when a live (approved) operator changes their GCash payout, so they can re-verify
// within the 3-day grace window before the public gate auto-pauses the listing. Best-effort; never
// throws (mirrors sendEmail). Recipients come from a service-role RPC so operator sessions can't
// enumerate admin emails.
export async function notifyAdminsGcashChanged(opts: {
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
    const subject = `GCash changed: ${who} — review within 3 days`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;line-height:1.6">
        <p><strong>${escapeHtml(who)}</strong>${
          opts.operatorEmail ? ` (${escapeHtml(opts.operatorEmail)})` : ""
        } just changed their GCash payout details on Tuloy.</p>
        <p>Their booking page stays live for <strong>3 days</strong>, then pauses until you confirm
        the new GCash name matches their ID.</p>
        <p><a href="https://tuloy.racynibaya.com/admin/operators" style="color:#ff385c">Review in Admin → Operators</a></p>
      </div>`;
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })));
  } catch (err) {
    console.error("[gcash-alert] failed", err);
  }
}
