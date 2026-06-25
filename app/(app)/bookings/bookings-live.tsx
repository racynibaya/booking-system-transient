"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

// Live bookings board. Subscribes to Realtime postgres_changes on the operator's own bookings
// (RLS-enforced; the tenant filter is defense-in-depth + noise reduction) and, on a change,
// triggers a debounced router.refresh() so the server-rendered table refetches in place. A new
// booking also pops a toast so the operator notices without staring at the screen.
//
// Renders nothing — the server-rendered <BookingsTable> stays the single source of truth; this
// only nudges it to refetch.
export function BookingsLive({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Coalesce a burst of events into a single refetch.
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Pass the operator JWT to Realtime so RLS applies, then subscribe.
    void supabase.realtime.setAuth().then(() => {
      channel = supabase
        .channel(`bookings:${tenantId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const guest = (payload.new as { guest_name?: string }).guest_name;
            toast.success(guest ? `Bagong booking kay ${guest}` : "Bagong booking");
            refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => refresh(),
        )
        .subscribe();
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tenantId, router]);

  return null;
}
