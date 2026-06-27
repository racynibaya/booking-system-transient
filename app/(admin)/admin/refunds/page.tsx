import { RefundsPanel } from "@/components/admin/refunds-panel";
import { PageHeader } from "@/components/ui/page-header";
import { getRecentOnlinePayouts, requireAdmin } from "@/lib/supabase/admin-dal";

// Admin-only: refund a guest's online deposit from the platform wallet. Refund straight from a recent
// payment row, or look one up by booking ID (e.g. from PayMongo metadata). The refund → ledger
// clawback logic lives in refundBooking; this is just the operator surface for it.
export default async function AdminRefundsPage() {
  await requireAdmin();
  const recent = await getRecentOnlinePayouts();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Refunds"
        description="Refund a guest's online deposit from the Tuloy wallet. Pick a recent payment below, or look up a booking by ID — you'll see what was captured before confirming a full or partial refund."
      />
      <RefundsPanel recent={recent} />
    </div>
  );
}
