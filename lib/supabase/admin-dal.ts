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
};

// The whole command-center dashboard in one self-guarded round-trip.
export const getDashboardOverview = cache(async (): Promise<DashboardOverview | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_overview");
  if (error || !data) return null;
  return data as unknown as DashboardOverview;
});
