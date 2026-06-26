import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { renewalReminderEmail } from "@/lib/email/templates";
import { PLANS, type PlanId } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";

// Scheduled billing housekeeping (Phase A) — the automated "watching" that replaces us remembering:
//   1. flip lapsed active plans → past_due (so the admin/operator views surface the lapse).
//   2. email a renewal nudge to operators renewing soon or already past due.
// Driven by a scheduler (e.g. a daily Vercel Cron) that sends `Authorization: Bearer <CRON_SECRET>`.
// Dormant + locked: with no CRON_SECRET it refuses every call, so the endpoint can't be triggered.

const REMINDER_WINDOW_DAYS = 3;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return new Response("cron not configured", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createServiceClient();

  // 1. Flag lapsed actives. Idempotent — re-running flips nothing already past_due. This is now purely
  // COSMETIC (drives the past-due badge + reminders): actual enforcement is LIVE at the booking engine
  // via tenant_subscription_entitlement, so it no longer depends on this cron running.
  const { data: flagged, error: flagErr } = await admin.rpc("flag_past_due_subscriptions");
  if (flagErr) {
    return Response.json({ ok: false, error: flagErr.message }, { status: 500 });
  }

  // 1b. Observability for the live enforcement switch (billing_config, the single source of truth —
  // replaces the old SUBSCRIPTION_ENFORCEMENT env flag and the plan-mutating downgrade). When the mode
  // is 'dry_run' or 'enforce', report how many operators are lapsed-past-grace, i.e. how many would be /
  // are blocked from taking new bookings. 'dry_run' = watch this number against real operators before
  // flipping to 'enforce'. We DON'T mutate plan/status here; the entitlement view does the gating live.
  const { data: cfg } = await admin.from("billing_config").select("enforcement_mode").single();
  const enforcementMode = cfg?.enforcement_mode ?? "off";
  let lapsed = 0;
  if (enforcementMode !== "off") {
    const { count } = await admin
      .from("tenant_subscription_entitlement")
      .select("tenant_id", { count: "exact", head: true })
      .eq("is_lapsed", true);
    lapsed = count ?? 0;
  }

  // 2. Reminder set: paid plans renewing within the window OR already past due.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + REMINDER_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: due } = await admin
    .from("tenants")
    .select("user_id, plan, subscription_status, paid_until")
    .in("subscription_status", ["active", "past_due"])
    .not("paid_until", "is", null)
    .lte("paid_until", cutoffStr);

  const origin = env.SITE_URL ?? "";
  let reminders = 0;
  for (const t of due ?? []) {
    if (t.plan === "free") continue; // free has nothing to renew
    const planId = t.plan as PlanId;
    // Session-less: resolve the operator's email via the admin auth API (tenant.user_id).
    const { data: u } = await admin.auth.admin.getUserById(t.user_id as string);
    const email = u.user?.email;
    if (!email) continue;

    const { subject, html } = renewalReminderEmail({
      planLabel: PLANS[planId].label,
      price: PLANS[planId].price,
      renewsOn: formatDate(t.paid_until),
      pastDue: t.subscription_status === "past_due",
      settingsUrl: `${origin}/settings`,
    });
    await sendEmail({ to: email, subject, html }); // never throws; dry-run logs when no key
    reminders++;
  }

  return Response.json({ ok: true, flagged, enforcementMode, lapsed, reminders });
}
