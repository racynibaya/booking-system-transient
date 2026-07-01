import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentTenant } from "./dal";
import { createClient } from "./server";

// Admin Data Access Layer. Cross-tenant, platform-scoped reads live here — separate from the
// operator-scoped lib/supabase/dal.ts. The privileged surface stays in one module so the trust
// boundary is easy to audit. The underlying RPCs are SECURITY DEFINER and self-guard on is_admin
// (see supabase/migrations), so this layer doesn't need the service-role key.

// Use in admin Server Components/Actions: returns the admin's tenant or 404s. Each page calls this
// (not just the layout) — layouts don't re-run on navigation under Partial Rendering.
export const requireAdmin = cache(async () => {
  const tenant = await getCurrentTenant();
  if (!tenant?.is_admin) notFound();
  return tenant;
});

export type AdminPaymentMethod = {
  type: "gcash" | "maya" | "bank" | "grabpay";
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
};

export type AdminOperatorRow = {
  tenant_id: string;
  name: string | null;
  email: string;
  verification_status: "pending" | "approved" | "suspended" | "changes_requested";
  verification_note: string | null;
  gcash_changed_at: string | null;
  payment_methods: AdminPaymentMethod[];
  // null until the operator starts Xendit onboarding; 'LIVE' = can accept online payments.
  xendit_kyc_status:
    | "INVITED"
    | "REGISTERED"
    | "AWAITING_DOCS"
    | "PENDING_VERIFICATION"
    | "LIVE"
    | "SUSPENDED"
    | null;
  created_at: string;
};

// Every operator for the admin review queue, via the self-guarded admin_list_operators RPC.
export const listOperators = cache(async (): Promise<AdminOperatorRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_operators");
  return (data ?? []) as unknown as AdminOperatorRow[];
});

export type DashboardOverview = {
  financials: { gmv: number; deposits: number; pipeline: number; avg_booking: number };
  operators: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
    changes_requested: number;
    gcash_flagged: number;
  };
  bookings: {
    total: number;
    held: number;
    awaiting: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    expired: number;
    no_show: number;
    confirmation_rate: number;
    cancellation_rate: number;
    no_show_rate: number;
  };
  trend: { week_start: string; gmv: number; bookings: number }[];
  supply: {
    properties: number;
    rooms: number;
    capacity: number;
    dot_accredited: number;
    by_area: { area: string; properties: number }[];
  };
  upcoming: { next7: number; next7_guests: number; next30: number; next30_guests: number };
  // G. Commission / payout money — the real revenue post-D10, from the payout ledger.
  finance: {
    commission_total: number;
    commission_30d: number;
    owner_payout_pending: number;
    payouts: {
      clearing: number;
      payable: number;
      paid: number;
      failed: number;
      refunded: number;
      clawed_back: number;
    };
  };
};

// The whole command-center dashboard in one self-guarded round-trip.
export const getDashboardOverview = cache(async (): Promise<DashboardOverview | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_overview");
  if (error || !data) return null;
  return data as unknown as DashboardOverview;
});

// One sample row inside an action-center bucket. `id` is the tenant / ledger / thread id the row
// points at; the UI links it to the relevant section.
export type ActionItem = { id: string; label: string; sublabel: string };
export type ActionBucket = { count: number; items: ActionItem[] };

// The consolidated "needs me now" surface — only buckets an admin genuinely acts on.
export type ActionCenter = {
  pending_kyc: ActionBucket;
  changes_requested: ActionBucket;
  gcash_reverify: ActionBucket;
  failed_payouts: ActionBucket;
  aging_inquiries: ActionBucket;
};

export const getActionCenter = cache(async (): Promise<ActionCenter | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_action_center");
  if (error || !data) return null;
  return data as unknown as ActionCenter;
});

// Platform activity pulse: operator signups, booking confirmations, submitted reviews.
export type ActivityEvent = {
  kind: "operator_signup" | "booking_confirmed" | "review_submitted";
  title: string;
  subtitle: string;
  at: string;
};

export const getActivityFeed = cache(async (): Promise<ActivityEvent[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_activity_feed");
  return (data ?? []) as unknown as ActivityEvent[];
});

// --- Finance section (Slice 2) — all sourced from the payout ledger -------------------------------

export type PayoutStatus = "clearing" | "payable" | "paid" | "failed" | "refunded" | "clawed_back";

export type FinanceOverview = {
  commission: { total: number; d30: number; d7: number };
  gross: {
    stay_value: number;
    deposits: number;
    service_fees: number;
    paymongo_fees: number;
    owner_payouts: number;
  };
  pending_owner_payout: number;
  // Keyed by PayoutStatus; only statuses present in the ledger appear.
  by_status: Partial<Record<PayoutStatus, { count: number; owner_payout: number }>>;
  trend: { label: string; value: number }[];
};

export const getFinanceOverview = cache(async (): Promise<FinanceOverview | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_finance_overview");
  if (error || !data) return null;
  return data as unknown as FinanceOverview;
});

export type PayoutRow = {
  id: string;
  operator_name: string;
  guest_name: string;
  property_name: string;
  stay_value: number;
  deposit_amount: number;
  operator_commission: number;
  owner_payout: number;
  status: PayoutStatus;
  clear_eta: string;
  created_at: string;
  total_count: number;
};

// Paginated, optionally status-filtered ledger rows. `total_count` (window count) rides on each row.
export const listPayouts = cache(
  async (opts: { status?: string; limit?: number; offset?: number } = {}): Promise<PayoutRow[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc("admin_list_payouts", {
      p_status: opts.status ?? undefined,
      p_limit: opts.limit ?? 50,
      p_offset: opts.offset ?? 0,
    });
    return (data ?? []) as unknown as PayoutRow[];
  },
);
