import "server-only";

import { Resend } from "resend";

import { env } from "@/env";

// Transactional email transport (F1.5). One thin helper so callers don't touch the
// SDK directly. Two hard rules live here:
//
//   1. NEVER THROWS. A send failure must not roll back a confirmed booking
//      (build-plan F1.5: "tolerate send failure without rolling back"). Callers
//      get a boolean; they log and move on.
//   2. SAFE BY DEFAULT. With no RESEND_API_KEY (dev/CI), we log the payload and
//      make no external call — local Supabase's Inbucket only catches Auth SMTP,
//      not Resend, so there's nothing to route to. Real sending is opt-in via env.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

// Verified-domain sender in prod; the resend.dev sandbox address is only ever used
// for the dev log line (we never actually send with it).
const DEV_FROM = "Tuloy <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const resend = getClient();

  // No key → log-and-skip. The safe default for dev/CI and the "needs explicit
  // confirmation before sending real email" guardrail (project rules).
  if (!resend) {
    console.info("[email:dry-run] would send", {
      to: message.to,
      subject: message.subject,
      bytes: message.html.length,
    });
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM ?? DEV_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (error) {
      console.error("[email] send failed", message.subject, error);
      return false;
    }
    return true;
  } catch (err) {
    // Network/SDK throw — swallow it. A confirmed booking stays confirmed.
    console.error("[email] send threw", message.subject, err);
    return false;
  }
}
