"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// Operator posts / edits their single public reply to a review (S5). The reply_to_review RPC is
// column- and tenant-scoped (definer), so the operator can only touch the reply on their own
// reviews — never a guest's rating or comment. A blank reply clears it. revalidate so the reply
// shows immediately here (and, on next request, on the public listing).
export async function replyToReview(reviewId: string, reply: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(reviewId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const trimmed = reply.trim();
  if (trimmed.length > 2000) {
    return { ok: false, error: "That reply is a bit long — trim it down." };
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_to_review", {
    p_review_id: reviewId,
    p_reply: trimmed,
  });
  if (error) return { ok: false, error: "Couldn't save your reply. Please try again." };

  revalidatePath("/reviews");
  return { ok: true };
}
