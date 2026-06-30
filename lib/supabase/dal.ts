import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { unitsAvailableOn } from "@/lib/availability";
import { effectiveStatus, type BookingFilters } from "@/lib/bookings";
import { addDays, fromDateStr, toDateStr, todayStr, type DateStr } from "@/lib/dates";
import { guestKey } from "@/lib/guests";
import { DEFAULT_COMMISSION_RATE } from "@/lib/pricing";
import { bookedRoomNights, daysInRange, monthRange, occupancyPct, weekRange } from "@/lib/reports";

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

// M2 — the operator's inquiry Inbox. RLS-scoped: only the operator's own threads. The list carries
// a last-message preview; the detail carries the full message history. Guests never read here (the
// public thread page uses the service-role token path).
export const getInquiryThreads = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiry_threads")
    .select(
      "id, guest_name, awaiting_operator, last_message_at, created_at, properties(name), inquiry_messages(body, sender, created_at)",
    )
    .order("last_message_at", { ascending: false });
  if (error || !data) return [];
  return data.map(({ inquiry_messages, ...t }) => {
    const msgs = [...(inquiry_messages ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const last = msgs.at(-1);
    return { ...t, preview: last?.body ?? "", lastSender: last?.sender ?? null };
  });
});

export const getInquiryThread = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiry_threads")
    .select(
      "id, guest_name, guest_email, guest_phone, token, awaiting_operator, created_at, properties(name, slug), inquiry_messages(id, sender, body, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const messages = [...(data.inquiry_messages ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  return { ...data, messages };
});

// M4 — the earnings ledger. The cash/deposit half (live now): per real booking (confirmed /
// completed), what it's worth, what's been collected in cash/GCash, Tuloy's 2.5% commission, the
// operator's net, and any outstanding balance. RLS-scoped. Online-settled rows light up here once
// the Xendit rail clears (kept separate; this half never touches the gated money path).
const round2 = (n: number) => Math.round(n * 100) / 100;

export const getEarnings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, guest_name, check_in, check_out, status, total_amount, payments(amount, status)")
    .in("status", ["confirmed", "completed"])
    .order("check_in", { ascending: false });

  const rows = (data ?? []).map((b) => {
    const total = b.total_amount ?? 0;
    const collected = (b.payments ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const commission = round2(total * DEFAULT_COMMISSION_RATE);
    return {
      id: b.id,
      guestName: b.guest_name,
      checkIn: b.check_in,
      checkOut: b.check_out,
      status: b.status,
      total,
      collected,
      commission,
      net: round2(total - commission),
      balance: round2(total - collected),
    };
  });

  const sum = (k: "total" | "collected" | "commission" | "net" | "balance") =>
    round2(rows.reduce((s, r) => s + r[k], 0));

  return {
    rows,
    gross: sum("total"),
    collected: sum("collected"),
    commission: sum("commission"),
    net: sum("net"),
    outstanding: sum("balance"),
  };
});

// S3 — operator's saved reply templates + auto-reply config (RLS-scoped to the operator's tenant).
export const getInquiryTemplates = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiry_templates")
    .select("id, title, body, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data;
});

export const getInquiryAutoReply = cache(async () => {
  const user = await getUser();
  if (!user) return { enabled: true, text: "" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("inquiry_auto_reply_enabled, inquiry_auto_reply")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    enabled: data?.inquiry_auto_reply_enabled ?? true,
    text: data?.inquiry_auto_reply ?? "",
  };
});

// S1 — guest CRM. Derived from the operator's own bookings (RLS), grouped by guestKey. `stays` and
// `totalValue` count only real stays (confirmed/completed); the first row per key is the latest, so
// its name/contact represent the guest now.
export const getGuests = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("guest_name, guest_phone, guest_email, check_in, status, total_amount")
    .order("check_in", { ascending: false });

  const map = new Map<
    string,
    {
      key: string;
      name: string;
      phone: string | null;
      email: string | null;
      stays: number;
      totalValue: number;
      lastStay: string;
    }
  >();
  for (const b of data ?? []) {
    const key = guestKey(b.guest_phone, b.guest_email, b.guest_name);
    if (!key) continue;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: b.guest_name,
        phone: b.guest_phone,
        email: b.guest_email,
        stays: 0,
        totalValue: 0,
        lastStay: b.check_in,
      };
      map.set(key, g);
    }
    if (b.status === "confirmed" || b.status === "completed") {
      g.stays += 1;
      g.totalValue += b.total_amount ?? 0;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.stays - a.stays || b.lastStay.localeCompare(a.lastStay),
  );
});

// One guest's full history (all their bookings, newest first). null if the key matches nobody.
export const getGuest = cache(async (key: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, guest_email, check_in, check_out, num_guests, status, total_amount, properties(name), room_types(name)",
    )
    .order("check_in", { ascending: false });

  const rows = (data ?? []).filter(
    (b) => guestKey(b.guest_phone, b.guest_email, b.guest_name) === key,
  );
  if (rows.length === 0) return null;
  const f = rows[0];
  const settled = rows.filter((r) => r.status === "confirmed" || r.status === "completed");
  return {
    key,
    name: f.guest_name,
    phone: f.guest_phone,
    email: f.guest_email,
    stays: settled.length,
    totalValue: settled.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    bookings: rows,
  };
});

// ---------------------------------------------------------------------------
// S4 — Business insights. Everything here is DERIVED from existing rows (bookings,
// room_types, inquiry_threads) — no new tables, no money-path touch. All reads are
// RLS-scoped to the operator. Pure month/occupancy math is reused from lib/reports
// (the same helpers behind P3 reporting) so the figures match the rest of the app.
// ---------------------------------------------------------------------------

export type TrendPoint = { label: string; value: number };
export type FunnelStage = { label: string; count: number };
export type LeadTimeBucket = { label: string; count: number };
export type InsightsData = {
  hasData: boolean;
  revenueByMonth: TrendPoint[]; // booking value by stay month (pesos)
  occupancyByMonth: TrendPoint[]; // booked room-nights ÷ capacity, % per month
  funnel: FunnelStage[]; // last-90-day PERIOD TOTALS (not attributed per-inquiry)
  funnelDays: number;
  leadTime: LeadTimeBucket[]; // days between booking creation and check-in
};

const MONTHS_BACK = 6;
const FUNNEL_DAYS = 90;

// Rolling [start, end) month buckets ending with the current month, oldest first.
function monthBuckets(today: DateStr): { label: string; start: DateStr; end: DateStr }[] {
  const d = fromDateStr(today);
  const out: { label: string; start: DateStr; end: DateStr }[] = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const start = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    out.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      start: toDateStr(start),
      end: toDateStr(end),
    });
  }
  return out;
}

// Lead-time buckets (days from booking creation to check-in). Walk-ins booked on/after
// arrival land in the first bucket (clamped at 0).
const LEAD_BUCKETS: { label: string; max: number }[] = [
  { label: "0–1d", max: 1 },
  { label: "2–7d", max: 7 },
  { label: "8–14d", max: 14 },
  { label: "15–30d", max: 30 },
  { label: "31d+", max: Infinity },
];

export const getInsights = cache(async (): Promise<InsightsData> => {
  const today = todayStr();
  const supabase = await createClient();

  const [bookingsRes, roomsRes, inquiriesRes] = await Promise.all([
    supabase.from("bookings").select("check_in, check_out, created_at, status, total_amount"),
    supabase.from("room_types").select("quantity"),
    supabase.from("inquiry_threads").select("created_at"),
  ]);

  const bookings = bookingsRes.data ?? [];
  const totalUnits = (roomsRes.data ?? []).reduce((n, r) => n + (r.quantity ?? 0), 0);
  const inquiries = inquiriesRes.data ?? [];

  // Stays that sold inventory drive revenue + occupancy.
  const soldStays = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");

  const buckets = monthBuckets(today);
  const revenueByMonth: TrendPoint[] = buckets.map((m) => ({
    label: m.label,
    value: round2(
      soldStays
        .filter((b) => b.check_in >= m.start && b.check_in < m.end)
        .reduce((s, b) => s + (b.total_amount ?? 0), 0),
    ),
  }));

  const occupancyByMonth: TrendPoint[] = buckets.map((m) => {
    const nights = bookedRoomNights(soldStays, m.start, m.end);
    return { label: m.label, value: occupancyPct(nights, totalUnits, daysInRange(m.start, m.end)) };
  });

  // Funnel — PERIOD TOTALS over the last 90 days, not per-inquiry attribution (inquiry_threads
  // carries no booking link). created_at is an ISO timestamp; a date-string compare is chronological.
  const since = addDays(today, -FUNNEL_DAYS);
  const inquiriesIn = inquiries.filter((i) => i.created_at >= since).length;
  const createdIn = bookings.filter((b) => b.created_at >= since);
  const confirmedIn = createdIn.filter(
    (b) => b.status === "confirmed" || b.status === "completed",
  ).length;
  const funnel: FunnelStage[] = [
    { label: "Inquiries", count: inquiriesIn },
    { label: "Bookings made", count: createdIn.length },
    { label: "Confirmed", count: confirmedIn },
  ];

  // Lead-time distribution over sold stays.
  const leadCounts = new Array(LEAD_BUCKETS.length).fill(0);
  for (const b of soldStays) {
    const days = Math.max(0, daysInRange(b.created_at.slice(0, 10), b.check_in));
    const idx = LEAD_BUCKETS.findIndex((bk) => days <= bk.max);
    leadCounts[idx === -1 ? LEAD_BUCKETS.length - 1 : idx]++;
  }
  const leadTime: LeadTimeBucket[] = LEAD_BUCKETS.map((bk, i) => ({
    label: bk.label,
    count: leadCounts[i],
  }));

  return {
    hasData: bookings.length > 0 || inquiries.length > 0,
    revenueByMonth,
    occupancyByMonth,
    funnel,
    funnelDays: FUNNEL_DAYS,
    leadTime,
  };
});
