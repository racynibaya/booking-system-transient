import { format } from "date-fns";

import { fromDateStr } from "@/lib/dates";

// Plain-HTML transactional templates (F1.5). Two small emails — no JSX email
// library on purpose (simplest thing that works). Styles are INLINE because email
// clients strip <style>/external CSS. Each function is pure: booking data in,
// { subject, html } out — easy to unit-test, no I/O.

export type ConfirmationBooking = {
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  numGuests: number;
  depositAmount: number | null;
  totalAmount: number | null;
  source?: string | null;
};

// Brand tokens — Sea Glass, matching app/globals.css and the auth emails (NOT Airbnb coral).
const PRIMARY = "#2c7a6b"; // sea-green — links / accents
const INK = "#1d2a2c"; // deep slate-teal — headings, values
const MUTED = "#5e6c6e"; // teal-steel — body, labels
const MUTED_SOFT = "#8b9794"; // footer / disabled
const SURFACE = "#ecefec"; // soft canvas
const HAIRLINE = "#e2e7e3"; // row separators
const LOGO_URL = "https://tuloysanjuan.com/logo/tuloy-logo.png";

// Escape free-text (e.g. the operator's cancellation reason) before interpolating into the
// HTML email, so a stray < or & can't break or inject markup.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function peso(amount: number | null): string {
  if (amount == null) return "—";
  return `₱${amount.toLocaleString("en-PH")}`;
}

function prettyDate(s: string): string {
  return format(fromDateStr(s), "EEE, MMM d, yyyy");
}

function nights(checkIn: string, checkOut: string): number {
  const ms = fromDateStr(checkOut).getTime() - fromDateStr(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

// A labelled row in the details table.
export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;color:${MUTED};font-size:14px;">${label}</td>
    <td style="padding:9px 0;color:${INK};font-size:14px;text-align:right;font-weight:600;">${value}</td>
  </tr>`;
}

// Shared shell: white card on a soft canvas, Tuloy logo, content slot. Matches the
// branded auth emails (Supabase Confirm-signup / Reset-password) so every Tuloy email
// reads as one family. Exported so the admin-alert path can reuse it.
export function shell(heading: string, intro: string, rowsHtml: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:${SURFACE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE};">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="padding:32px 32px 0;">
            <img src="${LOGO_URL}" alt="Tuloy" width="104" style="display:block;height:auto;border:0;" />
          </td></tr>
          <tr><td style="padding:24px 32px 0;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:700;">${heading}</h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">${intro}</p>
          </td></tr>
          <tr><td style="padding:20px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${HAIRLINE};">
              ${rowsHtml}
            </table>
          </td></tr>
          <tr><td style="padding:24px 32px 36px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED_SOFT};border-top:1px solid ${SURFACE};padding-top:20px;">
              ${footer}<br />Built for San Juan, La Union operators.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Guest-facing: "you're confirmed". Reassuring; no operator-only data.
export function guestConfirmedEmail(b: ConfirmationBooking): { subject: string; html: string } {
  const n = nights(b.checkIn, b.checkOut);
  const rows =
    row("Check-in", prettyDate(b.checkIn)) +
    row("Check-out", prettyDate(b.checkOut)) +
    row("Guests", String(b.numGuests)) +
    row("Deposit received", peso(b.depositAmount)) +
    row("Total", peso(b.totalAmount));

  return {
    subject: "Your booking is confirmed 🎉",
    html: shell(
      `You're confirmed, ${b.guestName}!`,
      `Your ${n}-night stay is locked in — here's everything you need.`,
      rows,
      "Need to change something? Just reply to this email to reach your host. See you in San Juan!",
    ),
  };
}

// Guest-facing: "we got your request" — the Pro-tier auto-acknowledge (sent the moment a hold is
// created, gated to plan in ('pro','business')). Replaces the operator's manual "yes it's available,
// here's how to pay" reply. Nudges the guest to finish paying before the hold lapses.
export function guestRequestReceivedEmail(
  b: ConfirmationBooking,
  opts?: { holdMinutes?: number },
): { subject: string; html: string } {
  const n = nights(b.checkIn, b.checkOut);
  const window = opts?.holdMinutes ? ` for ${opts.holdMinutes} minutes` : "";
  const rows =
    row("Check-in", prettyDate(b.checkIn)) +
    row("Check-out", prettyDate(b.checkOut)) +
    row("Guests", String(b.numGuests)) +
    row("Deposit due", peso(b.depositAmount)) +
    row("Total", peso(b.totalAmount));

  return {
    subject: "We got your booking request 🙌",
    html: shell(
      `Got your request, ${b.guestName}!`,
      `Your ${n}-night request is held${window}. Pay your deposit and upload your payment screenshot on your booking page to lock in these dates.`,
      rows,
      "Finish on your booking page before the hold expires — once we receive your payment, your host confirms.",
    ),
  };
}

// Guest-facing: "your hold is about to expire" — the Pro-tier deposit-reminder follow-up (sent by the
// pre-expiry sweep for held bookings with no proof yet, gated to plan in ('pro','business')). The tool
// chases so the operator doesn't have to.
export function guestDepositReminderEmail(b: ConfirmationBooking): {
  subject: string;
  html: string;
} {
  const rows =
    row("Check-in", prettyDate(b.checkIn)) +
    row("Check-out", prettyDate(b.checkOut)) +
    row("Guests", String(b.numGuests)) +
    row("Deposit due", peso(b.depositAmount)) +
    row("Total", peso(b.totalAmount));

  return {
    subject: "Your hold is about to expire ⏳",
    html: shell(
      `Almost there, ${b.guestName}`,
      "Your dates are still held — but not for long. Pay your deposit and upload your payment screenshot on your booking page to secure them before the hold expires.",
      rows,
      "Once we receive your payment, your host confirms. Didn't mean to book? Ignore this and the hold releases on its own.",
    ),
  };
}

// Guest-facing: "your booking was cancelled" (F2.3 lifecycle). No operator data; the
// dates are released and the guest is invited to rebook.
export function guestCancelledEmail(
  b: ConfirmationBooking,
  reason?: string | null,
): { subject: string; html: string } {
  const rows =
    row("Check-in", prettyDate(b.checkIn)) +
    row("Check-out", prettyDate(b.checkOut)) +
    row("Guests", String(b.numGuests));

  const note = reason?.trim() ? ` Your host's note: “${escapeHtml(reason.trim())}”.` : "";

  return {
    subject: "Your booking has been cancelled",
    html: shell(
      `Booking cancelled, ${b.guestName}`,
      `The stay below has been cancelled and those dates released.${note} If this is unexpected, just reply to this email to reach your host.`,
      rows,
      "Still want to come? You're welcome to book again anytime.",
    ),
  };
}

// Operator-facing: subscription renewal nudge (Phase A). Sent by the billing cron when a plan is
// about to lapse or has gone past due — the automated reminder that replaces "us remembering".
export function renewalReminderEmail(input: {
  planLabel: string;
  price: string;
  renewsOn: string | null;
  pastDue: boolean;
  settingsUrl: string;
}): { subject: string; html: string } {
  const rows =
    row("Plan", input.planLabel) +
    row("Price", `${input.price} / month`) +
    row(input.pastDue ? "Lapsed" : "Renews", input.renewsOn ?? "—");

  return {
    subject: input.pastDue
      ? `Your ${input.planLabel} plan is past due`
      : `Your ${input.planLabel} plan renews soon`,
    html: shell(
      input.pastDue ? "Time to renew" : "Your plan renews soon",
      input.pastDue
        ? "Your plan has lapsed. Renew now to keep your booking page and tools running without interruption."
        : "Just a heads-up that your plan renews soon. Renew anytime — it only takes a tap.",
      rows,
      `Renew from your <a href="${input.settingsUrl}" style="color:${PRIMARY};">plan settings</a>. Questions? Just reply to this email.`,
    ),
  };
}

// Operator-facing: "new confirmed booking" + guest contact so they can reach out.
export function operatorBookingEmail(b: ConfirmationBooking): { subject: string; html: string } {
  // When Tuloy's demand-gen drove the booking, say so in the intro — the operator should feel the
  // effort the moment it lands, not have it disappear into "just another reservation".
  const fromTuloy = b.source === "tuloy";
  const rows =
    row("Guest", b.guestName) +
    row("Phone", b.guestPhone || "—") +
    row("Email", b.guestEmail || "—") +
    row("Check-in", prettyDate(b.checkIn)) +
    row("Check-out", prettyDate(b.checkOut)) +
    row("Guests", String(b.numGuests)) +
    row("Deposit", peso(b.depositAmount)) +
    row("Total", peso(b.totalAmount));

  return {
    subject: `New confirmed booking — ${b.guestName}`,
    html: shell(
      "New confirmed booking",
      fromTuloy
        ? "📣 Tuloy brought you this booking. You confirmed the deposit — the dates are now held as confirmed."
        : "You confirmed this deposit. The dates are now held as confirmed.",
      rows,
      "A record for your inbox — no action needed.",
    ),
  };
}
