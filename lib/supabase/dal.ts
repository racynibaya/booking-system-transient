import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { unitsAvailableOn } from "@/lib/availability";
import { effectiveStatus, type BookingFilters } from "@/lib/bookings";
import { addDays, todayStr } from "@/lib/dates";
import { monthRange, weekRange } from "@/lib/reports";

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
    .select("id, name, verification_status, is_admin, verification_note, gcash_changed_at")
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
});

// ---------------------------------------------------------------------------
// Dashboard summary reads. Three focused, RLS-scoped, cache()d reads the dashboard
// composes in parallel: money (collected / coming / owed), occupancy (open tonight +
// the next 7 nights), and the needs-action counts. Money is summed from the payments
// record (the source of truth); occupancy mirrors the live held+confirmed set used
// everywhere else (see getRoomCalendarData) and the pure unitsAvailableOn.
// ---------------------------------------------------------------------------

export type OwedBalance = {
  bookingId: string;
  guestName: string;
  propertyName: string;
  checkIn: string;
  balance: number;
};
export type RevenueSummary = {
  collectedThisWeek: number;
  collectedThisMonth: number;
  comingThisMonth: number;
  owes: OwedBalance[];
  owesTotal: number;
};

export const getRevenueSummary = cache(async (): Promise<RevenueSummary> => {
  const today = todayStr();
  const week = weekRange(today);
  const month = monthRange(today);
  const supabase = await createClient();

  const [weekPayRes, monthPayRes, bookingsRes, paidRes] = await Promise.all([
    // Collected this week / this month: confirmed payments, by their record timestamp.
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "confirmed")
      .gte("created_at", week.start)
      .lt("created_at", week.end),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "confirmed")
      .gte("created_at", month.start)
      .lt("created_at", month.end),
    // Bookings that sold inventory and could still owe a balance.
    supabase
      .from("bookings")
      .select("id, guest_name, check_in, total_amount, properties(name)")
      .in("status", ["confirmed", "completed"]),
    // Every confirmed payment, to net off what each booking has actually paid.
    supabase.from("payments").select("booking_id, amount").eq("status", "confirmed"),
  ]);

  const sumAmounts = (rows: { amount: number | null }[] | null) =>
    (rows ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);

  const paidByBooking = new Map<string, number>();
  for (const p of paidRes.data ?? []) {
    paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) ?? 0) + (p.amount ?? 0));
  }

  const owes: OwedBalance[] = [];
  for (const b of bookingsRes.data ?? []) {
    const balance = (b.total_amount ?? 0) - (paidByBooking.get(b.id) ?? 0);
    if (balance > 0) {
      owes.push({
        bookingId: b.id,
        guestName: b.guest_name,
        propertyName: b.properties?.name ?? "—",
        checkIn: b.check_in,
        balance,
      });
    }
  }
  owes.sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  // "Coming this month" = the balance still owed on confirmed stays arriving this month
  // (guests typically pay the remainder on arrival).
  const comingThisMonth = owes
    .filter((o) => o.checkIn >= month.start && o.checkIn < month.end)
    .reduce((s, o) => s + o.balance, 0);

  return {
    collectedThisWeek: sumAmounts(weekPayRes.data),
    collectedThisMonth: sumAmounts(monthPayRes.data),
    comingThisMonth,
    owes,
    owesTotal: owes.reduce((s, o) => s + o.balance, 0),
  };
});

// ---------------------------------------------------------------------------
export type OccupancyNight = { date: string; open: number; total: number };
export type OccupancySnapshot = {
  tonightOpen: number;
  tonightTotal: number;
  nights: OccupancyNight[];
};

export const getOccupancySnapshot = cache(async (): Promise<OccupancySnapshot> => {
  const today = todayStr();
  const horizonEnd = addDays(today, 7); // next 7 nights, half-open [today, today+7)
  const nowIso = new Date().toISOString();
  const supabase = await createClient();

  const [roomsRes, bookingsRes, blocksRes] = await Promise.all([
    supabase.from("room_types").select("id, quantity"),
    supabase
      .from("bookings")
      .select("room_type_id, check_in, check_out, status, hold_expires_at")
      .in("status", ["held", "confirmed"])
      .gte("check_out", today)
      .lt("check_in", horizonEnd),
    supabase
      .from("availability_blocks")
      .select("room_type_id, start_date, end_date")
      .gte("end_date", today)
      .lt("start_date", horizonEnd),
  ]);

  const rooms = roomsRes.data ?? [];
  // Group the live held+confirmed bookings (lapsed holds free their inventory) and blocks
  // by room_type, in lib/availability's string-range shapes.
  const bookingsByRoom = new Map<string, { checkIn: string; checkOut: string }[]>();
  for (const b of bookingsRes.data ?? []) {
    if (b.status !== "confirmed" && b.hold_expires_at && b.hold_expires_at <= nowIso) continue;
    const arr = bookingsByRoom.get(b.room_type_id) ?? [];
    arr.push({ checkIn: b.check_in, checkOut: b.check_out });
    bookingsByRoom.set(b.room_type_id, arr);
  }
  const blocksByRoom = new Map<string, { start: string; end: string }[]>();
  for (const bl of blocksRes.data ?? []) {
    const arr = blocksByRoom.get(bl.room_type_id) ?? [];
    arr.push({ start: bl.start_date, end: bl.end_date });
    blocksByRoom.set(bl.room_type_id, arr);
  }

  const total = rooms.reduce((n, r) => n + (r.quantity ?? 0), 0);
  const nights: OccupancyNight[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const open = rooms.reduce(
      (n, r) =>
        n +
        unitsAvailableOn(
          date,
          r.quantity ?? 0,
          bookingsByRoom.get(r.id) ?? [],
          blocksByRoom.get(r.id) ?? [],
        ),
      0,
    );
    nights.push({ date, open, total });
  }

  return { tonightOpen: nights[0]?.open ?? 0, tonightTotal: total, nights };
});

export type NeedsActionCounts = { needsConfirmation: number; expiringHolds: number };

export const getNeedsActionCounts = cache(async (): Promise<NeedsActionCounts> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("status, hold_expires_at")
    .in("status", ["awaiting_confirmation", "held"]);

  if (error || !data) return { needsConfirmation: 0, expiringHolds: 0 };

  let needsConfirmation = 0;
  let expiringHolds = 0;
  for (const b of data) {
    // effectiveStatus drops lapsed holds to 'expired', so only live holds are counted —
    // matching the bookings board's "Needs action" view (awaiting_confirmation + live held).
    const eff = effectiveStatus(b.status, b.hold_expires_at);
    if (eff === "awaiting_confirmation") needsConfirmation++;
    else if (eff === "held") expiringHolds++;
  }
  return { needsConfirmation, expiringHolds };
});

// The current operator's payout methods (RLS-scoped — no explicit tenant filter needed).
// Empty array if none yet.
export const getPaymentMethods = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_payment_methods")
    .select("id, type, account_name, account_number, bank_name, qr_path, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return [];
  return data;
});

// The current operator's Xendit sub-account binding (the commission rail). RLS-scoped, select-only;
// null until they start onboarding. kyc_status='LIVE' is what lets them accept online payments — the
// webhook (lib/xendit/webhook-handler.ts) is the only writer of that column.
export const getXenditAccount = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_xendit_accounts")
    .select(
      "id, sub_account_id, type, kyc_status, commission_rate, kyc_submitted_at, payout_channel_code, payout_account_number, payout_account_name, updated_at",
    )
    .maybeSingle();

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

// All properties + their room types (id, name, quantity) for the top-level availability calendar
// (M3). RLS-scoped. quantity drives the per-day units-available math in RoomCalendar.
export const getCalendarProperties = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, room_types(id, name, quantity)")
    .order("name", { ascending: true });
  if (error || !data) return [];
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

// Bookings for the current operator (RLS-scoped — no explicit tenant filter needed),
// powering the F2.1 dashboard. The scale-sensitive filters (property, room, check-in
// range, guest search) are pushed to Postgres here. Status is NOT filtered here: the
// display status is derived by effectiveStatus (a lapsed 'held' shows as 'expired' but
// is still 'held' in the row), so the status multi-select and the smart views are applied
// downstream in the page over the reconciled rows.
export const getBookings = cache(async (filters: BookingFilters = {}) => {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, guest_email, check_in, check_out, num_guests, status, hold_expires_at, created_at, deposit_amount, total_amount, source, proof_url, properties(name), room_types(name)",
    );

  if (filters.property) query = query.eq("property_id", filters.property);
  if (filters.room) query = query.eq("room_type_id", filters.room);
  if (filters.from) query = query.gte("check_in", filters.from);
  if (filters.to) query = query.lte("check_in", filters.to);
  if (filters.q) {
    // Sanitize for PostgREST .or() grammar: drop the reserved , ( ) * and the % wildcard,
    // then wrap in %…% for a substring ilike across the guest contact fields.
    const safe = filters.q.replace(/[,()*%]/g, " ").trim();
    if (safe) {
      query = query.or(
        `guest_name.ilike.%${safe}%,guest_phone.ilike.%${safe}%,guest_email.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query.order("check_in", { ascending: false });
  if (error || !data) return [];
  // Reconcile lapsed holds to 'expired' for display (see effectiveStatus). created_at and
  // hold_expires_at were once stripped here as "internal"; they are now intentionally RETAINED
  // because the Needs-action urgency sort races both clocks (see urgencyAt in lib/bookings).
  // Don't re-strip them without moving that sort. Swap the stored proof path for a short-lived
  // signed URL so the operator can eyeball the receipt inline instead of confirming blind (the
  // bucket is private; the path alone isn't viewable).
  return Promise.all(
    data.map(async ({ proof_url, ...b }) => {
      let proofUrl: string | null = null;
      if (proof_url) {
        const { data: signed } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(proof_url, 60 * 10); // 10 min
        proofUrl = signed?.signedUrl ?? null;
      }
      return { ...b, proofUrl, status: effectiveStatus(b.status, b.hold_expires_at) };
    }),
  );
});

// One booking, in full — the booking/guest record (M5). RLS-scoped to the operator's tenant, so a
// foreign id just returns null (→ notFound). Same proof-signing + lapsed-hold reconciliation as
// getBookings, plus contact + amount fields the detail view needs.
export const getBooking = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, guest_email, check_in, check_out, num_guests, status, hold_expires_at, created_at, deposit_amount, total_amount, source, proof_url, cancellation_reason, properties(name, slug), room_types(name), payments(amount, status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const { proof_url, ...b } = data;
  let proofUrl: string | null = null;
  if (proof_url) {
    const { data: signed } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof_url, 60 * 10); // 10 min
    proofUrl = signed?.signedUrl ?? null;
  }
  return { ...b, proofUrl, status: effectiveStatus(b.status, b.hold_expires_at) };
});

// Lean read for the bookings filter bar's Property → Room-type dropdowns (RLS-scoped):
// just ids + names. getProperties() only carries a room_types(count), so it can't drive
// the dependent room menu.
export const getBookingFilterOptions = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, room_types(id, name)")
    .order("name", { ascending: true });

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

// Everything the manual booking-entry form (F2.2) needs in one RLS-scoped read:
// the operator's properties (with deposit_percent for the live deposit preview),
// each property's room_types, and per-room calendar data (live bookings + blocks)
// so the date picker can disable sold-out days — the same availability source the
// public flow and the RPC use. Operator scale is a handful of rooms, so the per-room
// getRoomCalendarData fan-out is fine and keeps the page a thin Server Component.
export const getManualBookingFormData = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, deposit_percent, room_types(id, name, capacity, quantity, base_price)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return Promise.all(
    data.map(async (p) => ({
      id: p.id as string,
      name: p.name as string,
      deposit_percent: p.deposit_percent as number,
      rooms: await Promise.all(
        p.room_types.map(async (r) => {
          const { bookings, blocks } = await getRoomCalendarData(r.id as string);
          return {
            id: r.id as string,
            name: r.name as string,
            capacity: r.capacity as number,
            quantity: r.quantity as number,
            base_price: r.base_price as number,
            bookings, // StayRange[]: { checkIn, checkOut }
            blocks: blocks.map((b) => ({ start: b.start, end: b.end })), // BlockRange[]
          };
        }),
      ),
    })),
  );
});
