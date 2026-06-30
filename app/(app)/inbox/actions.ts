"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notifyGuestReply } from "@/lib/email/inquiry";
import { requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// Operator replies to a guest inquiry (M2). RLS scopes the insert to the operator's own thread
// (the messages insert policy checks the thread's tenant), and the bump trigger flips the thread
// out of "awaiting operator". Notifying the guest by email (with the tokenized thread link) lands
// in M2b. revalidate the inbox subtree + dashboard so the unanswered signal updates.
export async function replyToInquiry(threadId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!z.uuid().safeParse(threadId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!trimmed) return { ok: false, error: "Write a reply first." };
  if (trimmed.length > 4000)
    return { ok: false, error: "That reply is a bit long — trim it down." };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("inquiry_messages")
    .insert({ thread_id: threadId, sender: "operator", body: trimmed });
  if (error) return { ok: false, error: "Couldn't send your reply. Please try again." };

  // Best-effort: email the guest a link to read the reply on their tokenized thread page.
  const { data: thread } = await supabase
    .from("inquiry_threads")
    .select("token, guest_email, properties(name)")
    .eq("id", threadId)
    .maybeSingle();
  if (thread?.guest_email) {
    await notifyGuestReply({
      guestEmail: thread.guest_email,
      propertyName: thread.properties?.name ?? "your stay",
      token: thread.token,
      body: trimmed,
    });
  }

  revalidatePath("/inbox", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}
