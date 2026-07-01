"use server";

import { revalidatePath } from "next/cache";

import { notifyOperatorGuestReply } from "@/lib/email/inquiry";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

// Guest posts a follow-up from their tokenized thread page (no account). Service-role path: the
// token is the credential — we look the thread up by it, append the message (trigger flips the
// thread back to "awaiting operator"), and nudge the operator.
export async function postGuestMessage(token: string, body: string): Promise<Result> {
  const trimmed = body.trim();
  if (!token || token.length < 16) return { ok: false, error: "This link looks invalid." };
  // Throttle per conversation so a leaked thread link can't be used to spam the operator's inbox.
  if (!(await rateLimit(`inq:msg:${token}`, 20, 300))) {
    return { ok: false, error: "You're sending messages too fast. Please wait a moment." };
  }
  if (!trimmed) return { ok: false, error: "Write a message first." };
  if (trimmed.length > 2000)
    return { ok: false, error: "That message is a bit long — trim it down." };

  const admin = createServiceClient();
  const { data: thread } = await admin
    .from("inquiry_threads")
    .select("id, tenant_id, guest_name, properties(name)")
    .eq("token", token)
    .maybeSingle();
  if (!thread) return { ok: false, error: "We couldn't find that conversation." };

  const { error } = await admin
    .from("inquiry_messages")
    .insert({ thread_id: thread.id, sender: "guest", body: trimmed });
  if (error) return { ok: false, error: "Couldn't send your message. Please try again." };

  await notifyOperatorGuestReply({
    tenantId: thread.tenant_id,
    propertyName: thread.properties?.name ?? "your listing",
    guestName: thread.guest_name,
    body: trimmed,
  });

  revalidatePath(`/inquiry/${token}`);
  return { ok: true };
}
