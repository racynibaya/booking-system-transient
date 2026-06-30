import "server-only";

import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { row, shell } from "@/lib/email/templates";
import { createServiceClient } from "@/lib/supabase/server";

// M2 inquiry notifications. All best-effort (never throw — a send failure must not break the
// message that was just posted). In-app conversation; the email is only a nudge with a link back.
const BASE = env.SITE_URL ?? "https://tuloysanjuan.com";

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

// Resolve the operator's email from a tenant via service-role auth admin (no operator session in
// the guest-initiated paths).
async function operatorEmail(tenantId: string): Promise<string | null> {
  const admin = createServiceClient();
  const { data: t } = await admin
    .from("tenants")
    .select("user_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!t?.user_id) return null;
  const { data } = await admin.auth.admin.getUserById(t.user_id);
  return data.user?.email ?? null;
}

export async function notifyOperatorNewInquiry(o: {
  tenantId: string;
  propertyName: string;
  guestName: string;
  body: string;
}): Promise<void> {
  try {
    const to = await operatorEmail(o.tenantId);
    if (!to) return;
    const html = shell(
      "New guest question",
      `${esc(o.guestName)} asked a question about ${esc(o.propertyName)}.`,
      row("Question", esc(o.body)),
      `Reply in <a href="${BASE}/inbox" style="color:#2c7a6b">your Inbox</a>.`,
    );
    await sendEmail({ to, subject: `New question about ${o.propertyName}`, html });
  } catch (err) {
    console.error("[inquiry] notifyOperatorNewInquiry failed", err);
  }
}

export async function notifyOperatorGuestReply(o: {
  tenantId: string;
  propertyName: string;
  guestName: string;
  body: string;
}): Promise<void> {
  try {
    const to = await operatorEmail(o.tenantId);
    if (!to) return;
    const html = shell(
      "New reply from a guest",
      `${esc(o.guestName)} replied about ${esc(o.propertyName)}.`,
      row("Reply", esc(o.body)),
      `Continue in <a href="${BASE}/inbox" style="color:#2c7a6b">your Inbox</a>.`,
    );
    await sendEmail({ to, subject: `${o.guestName} replied — ${o.propertyName}`, html });
  } catch (err) {
    console.error("[inquiry] notifyOperatorGuestReply failed", err);
  }
}

export async function notifyGuestReply(o: {
  guestEmail: string;
  propertyName: string;
  token: string;
  body: string;
}): Promise<void> {
  try {
    const link = `${BASE}/inquiry/${o.token}`;
    const html = shell(
      "You have a reply",
      `The host at ${esc(o.propertyName)} replied to your question.`,
      row("Reply", esc(o.body)),
      `<a href="${link}" style="color:#2c7a6b">View the conversation</a> to read and respond.`,
    );
    await sendEmail({
      to: o.guestEmail,
      subject: `${o.propertyName} replied to your question`,
      html,
    });
  } catch (err) {
    console.error("[inquiry] notifyGuestReply failed", err);
  }
}
