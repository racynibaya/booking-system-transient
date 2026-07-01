"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Operator marks a booking's remaining balance as collected (the cash-on-arrival case the
// online flow never sees). We recompute the balance server-side from the money record —
// never trust a client amount — and append a 'balance' payment row. Payments are immutable
// and the insert is RLS-scoped (payments_insert_own → tenant_id = current_tenant_id()), so
// this is the operator recording their own receipt, not a privileged write.
//
// Idempotent against a double-click: the remaining balance is recomputed each call, so once
// the first insert lands the next call sees 0 owed and no-ops.
export async function markBalanceCollected(bookingId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(bookingId).success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };

  const supabase = await createClient();

  const [bookingRes, paidRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, total_amount, status")
      .eq("id", bookingId)
      .in("status", ["confirmed", "completed"])
      .maybeSingle(),
    supabase
      .from("payments")
      .select("amount")
      .eq("booking_id", bookingId)
      .eq("status", "confirmed"),
  ]);

  const booking = bookingRes.data;
  if (!booking) return { ok: false, error: "Couldn't find that booking." };

  const paid = (paidRes.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const remaining = (booking.total_amount ?? 0) - paid;
  if (remaining <= 0) {
    // Already settled (or a double-click that lost the race) — nothing to record.
    revalidatePath("/dashboard");
    revalidatePath("/bookings", "layout");
    return { ok: true };
  }

  const { error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    tenant_id: tenant.id,
    kind: "balance",
    status: "confirmed",
    provider: "manual",
    amount: remaining,
  });
  if (error) return { ok: false, error: "Couldn't record the payment. Please try again." };

  revalidatePath("/dashboard");
  revalidatePath("/bookings", "layout");
  return { ok: true };
}
