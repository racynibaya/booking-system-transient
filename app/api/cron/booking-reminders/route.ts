import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { guestDepositReminderEmail } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyCallbackToken } from "@/lib/xendit/signature";

// Pre-expiry deposit-reminder sweep (Pro/Business perk — the inquiry-labor wedge). For held bookings
// nearing the end of their hold with no payment proof yet, email the guest one reminder so the tool
// chases instead of the operator. due_deposit_reminders() CLAIMS rows atomically (stamps
// reminder_sent_at and returns them), so a re-run / overlap never double-sends; the stamp lands even
// if the email fails — a rare missed reminder over ever spamming. The tier gate lives in the RPC.
//
// Dormant + locked: with no CRON_SECRET it refuses every call. No schedule is wired during the pilot —
// every operator is Solo, so there is nothing to remind. Point a scheduler (Vercel Cron once on Pro,
// or a free external pinger) at this endpoint every ~10 min once an operator upgrades to Pro.

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return new Response("cron not configured", { status: 503 });
  }
  if (!verifyCallbackToken(request.headers.get("authorization"), `Bearer ${env.CRON_SECRET}`)) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin.rpc("due_deposit_reminders");
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let reminders = 0;
  for (const b of data ?? []) {
    if (!b.guest_email) continue; // the RPC already filters these out; belt-and-suspenders
    const { subject, html } = guestDepositReminderEmail({
      guestName: b.guest_name,
      guestEmail: b.guest_email,
      guestPhone: null,
      checkIn: b.check_in,
      checkOut: b.check_out,
      numGuests: b.num_guests,
      depositAmount: b.deposit_amount == null ? null : Number(b.deposit_amount),
      totalAmount: b.total_amount == null ? null : Number(b.total_amount),
    });
    await sendEmail({ to: b.guest_email, subject, html }); // never throws; dry-run logs without a key
    reminders++;
  }

  return Response.json({ ok: true, reminders });
}
