"use server";

import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";

// S5 — guest submits their review through the service-role path, the token in the URL as the
// credential (no login), mirroring the inquiry guest actions. One submit per invite: the update is
// guarded on `submitted_at is null`, so a reused link is a no-op (idempotent).
const submitInput = z.object({
  token: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function submitReview(
  raw: z.infer<typeof submitInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = submitInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please choose a star rating." };
  const { token, rating, comment } = parsed.data;

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("reviews")
    .update({
      rating,
      comment: comment?.trim() || null,
      submitted_at: new Date().toISOString(),
    })
    .eq("token", token)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "Couldn't save your review. Please try again." };
  if (!data) return { ok: false, error: "This review link has already been used." };
  return { ok: true };
}
