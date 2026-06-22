import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentTenant } from "./dal";
import { createClient } from "./server";
import type { Database } from "./database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

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

export type AdminPlatformStats = {
  operators: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
    changes_requested: number;
    gcash_flagged: number;
    trialing: number;
    active: number;
  };
  bookings: {
    confirmed: number;
    awaiting: number;
    gmv: number;
    deposits: number;
    upcoming: number;
  };
};

// Platform-wide counts for the admin overview, via the self-guarded admin_platform_stats RPC.
export const getPlatformStats = cache(async (): Promise<AdminPlatformStats | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error || !data) return null;
  return data as unknown as AdminPlatformStats;
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
    trialing: number;
    active: number;
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

export type BillingHealth = {
  paying: number;
  due_soon: number;
  past_due: number;
  overdue_list: { name: string | null; plan: string; paid_until: string | null }[];
};

// Subscription billing health for the admin dashboard — who pays, who renews soon, who lapsed.
export const getBillingHealth = cache(async (): Promise<BillingHealth | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_billing_health");
  if (error || !data) return null;
  return data as unknown as BillingHealth;
});

export type AdminRecentBooking = {
  booking_id: string;
  operator_name: string | null;
  guest_name: string;
  total_amount: number | null;
  status: BookingStatus;
  created_at: string;
};

// Latest bookings across every operator — the dashboard transactions table.
export const getRecentBookings = cache(async (): Promise<AdminRecentBooking[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_bookings");
  return (data ?? []) as unknown as AdminRecentBooking[];
});

export type AdminActivity = {
  kind: "operator_signup" | "booking_confirmed";
  title: string;
  subtitle: string;
  at: string;
};

// Interleaved platform activity (signups + confirmations) — the dashboard activity feed.
export const getRecentActivity = cache(async (): Promise<AdminActivity[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_activity");
  return (data ?? []) as unknown as AdminActivity[];
});
