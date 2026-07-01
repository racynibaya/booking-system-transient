import "server-only";

import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { shell } from "@/lib/email/templates";

// S5 review-invite email. Best-effort like the inquiry nudges (never throws — a send failure must
// not affect the invite row that was just minted). The email hands the guest their tokenized review
// link; the review itself is filled and read inside Tuloy.
const BASE = env.SITE_URL ?? "https://tuloysanjuan.com";

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

// Sent once, after a stay ends, when the invite row is first minted (mint_review_invites).
export async function notifyGuestReviewInvite(o: {
  guestEmail: string;
  guestName: string;
  propertyName: string;
  token: string;
}): Promise<void> {
  try {
    const link = `${BASE}/review/${o.token}`;
    const html = shell(
      "How was your stay?",
      `Hi ${esc(o.guestName)}, thanks for staying at ${esc(o.propertyName)}. Would you leave a quick review?`,
      "",
      `<a href="${link}" style="color:#2c7a6b">Leave a review</a> — it takes a minute and helps other guests book with confidence.`,
    );
    await sendEmail({
      to: o.guestEmail,
      subject: `How was your stay at ${o.propertyName}?`,
      html,
    });
  } catch (err) {
    console.error("[reviews] notifyGuestReviewInvite failed", err);
  }
}
