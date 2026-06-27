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

// Email admins when an async disbursement comes back failed, so a human can reach the operator and
// help them fix their payout details. The operator's destination is auto-flagged 'failed' by the
// reconcile RPC; this is the human ping. Best-effort; never throws.
export async function notifyAdminsPayoutFailed(opts: {
  payoutId: string;
  reason: string | null;
}): Promise<void> {
  try {
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

    const subject = `Payout failed — ${opts.payoutId}`;
    const html = shell(
      "A payout failed",
      "A disbursement to an operator came back failed. Their payout destination has been flagged, so it won't be retried until they re-save valid details — reach out to help them fix it.",
      row("Payout", escapeHtml(opts.payoutId)) + row("Reason", escapeHtml(opts.reason ?? "—")),
      `Review in <a href="https://tuloysanjuan.com/admin/operators" style="color:#2c7a6b">Admin → Operators</a>.`,
    );
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })));
  } catch (err) {
    console.error("[payout-failed-alert] failed", err);
  }
}

// Email admins when a refund clawed back an ALREADY-PAID operator share — the v1 recovery is manual:
// withhold the owed amount from the operator's next payout by hand. The ledger row is marked
// 'clawed_back' for audit; this is the human ping with the figure. Best-effort; never throws.
export async function notifyAdminsClawback(opts: {
  bookingId: string;
  operatorName: string | null;
  owedAmount: number;
}): Promise<void> {
  try {
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

    const who = opts.operatorName ?? "an operator";
    const owed = `₱${opts.owedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    const subject = `Clawback — recover ${owed} from ${who}`;
    const html = shell(
      "A paid-out booking was refunded",
      `A booking that was already disbursed to ${escapeHtml(who)} has been refunded to the guest. Recover ${owed} by withholding it from their next payout — the ledger row is marked clawed_back for reference.`,
      row("Operator", escapeHtml(who)) +
        row("Owed back", escapeHtml(owed)) +
        row("Booking", escapeHtml(opts.bookingId)),
      `Review in <a href="https://tuloysanjuan.com/admin/operators" style="color:#2c7a6b">Admin → Operators</a>.`,
    );
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })));
  } catch (err) {
    console.error("[clawback-alert] failed", err);
  }
}
