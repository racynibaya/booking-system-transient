import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { todayStr } from "@/lib/dates";

import { createClient } from "./server";

// Data Access Layer. Auth checks live here (close to the data), not in layouts —
// layouts don't re-run on navigation under Partial Rendering, so a layout-only
// gate can leak. cache() memoizes per render pass so repeated calls in one
// request don't re-hit Supabase.

// Verified identity for the current request, or null. Always uses getUser()
// (revalidates the token with the auth server) rather than getSession().
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Use in protected Server Components/Actions: returns the user or redirects to
// /login. Never returns null.
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

// The current operator's tenant row, scoped by RLS. null if unauthenticated or
// (unexpectedly) un-provisioned.
export const getCurrentTenant = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, subscription_status")
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
});

// The current operator's GCash payout settings (RLS-scoped). null if un-provisioned.
export const getGcashSettings = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, gcash_name, gcash_number, gcash_qr_path")
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
});

// The current operator's properties (RLS-scoped — no explicit tenant filter
// needed) with a room_type count for the list view.
export const getProperties = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, slug, area, room_types(count)")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
});

// One property + its room_types, RLS-scoped. null if not the operator's.
export const getProperty = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*, room_types(*)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
});

// Bookings awaiting the operator's confirmation (F1.4/F1.5), RLS-scoped — newest
// first. Each carries a short-lived signed URL for the guest's payment proof so the
// operator can eyeball it before confirming (operator can read own-tenant proofs).
export const getPendingConfirmations = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, guest_email, check_in, check_out, num_guests, deposit_amount, total_amount, proof_url, properties(name), room_types(name)",
    )
    .eq("status", "awaiting_confirmation")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return Promise.all(
    data.map(async (b) => {
      let proofUrl: string | null = null;
      if (b.proof_url) {
        const { data: signed } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(b.proof_url, 60 * 10); // 10 min
        proofUrl = signed?.signedUrl ?? null;
      }
      return { ...b, proofUrl };
    }),
  );
});

// Every booking for the current operator (RLS-scoped — no explicit tenant filter
// needed), newest check-in first. Powers the F2.1 bookings dashboard: the client
// table does its own status + date-scope filtering, so this stays a lean single
// read (no per-row signed-proof round-trip like getPendingConfirmations).
export const getBookings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, guest_email, check_in, check_out, num_guests, status, deposit_amount, total_amount, properties(name), room_types(name)",
    )
    .order("check_in", { ascending: false });

  if (error || !data) return [];
  return data;
});

// Calendar data for one room_type (RLS-scoped): live held/confirmed bookings and
// future blocks, as YYYY-MM-DD strings for lib/availability. Expired holds excluded.
export const getRoomCalendarData = cache(async (roomTypeId: string) => {
  const supabase = await createClient();
  const today = todayStr();
  const nowIso = new Date().toISOString();

  const [bookingsRes, blocksRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("check_in, check_out, status, hold_expires_at")
      .eq("room_type_id", roomTypeId)
      .in("status", ["held", "confirmed"])
      .gte("check_out", today),
    supabase
      .from("availability_blocks")
      .select("id, start_date, end_date, reason")
      .eq("room_type_id", roomTypeId)
      .gte("end_date", today)
      .order("start_date"),
  ]);

  const bookings = (bookingsRes.data ?? [])
    .filter((b) => b.status === "confirmed" || !b.hold_expires_at || b.hold_expires_at > nowIso)
    .map((b) => ({ checkIn: b.check_in, checkOut: b.check_out }));

  const blocks = (blocksRes.data ?? []).map((b) => ({
    id: b.id as string,
    start: b.start_date,
    end: b.end_date,
    reason: b.reason,
  }));

  return { bookings, blocks };
});
