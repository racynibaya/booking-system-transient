import { PageHeader } from "@/components/ui/page-header";
import { listOperators, requireAdmin } from "@/lib/supabase/admin-dal";

import { OperatorRow } from "./operator-row";

// Admin-only: approve operators before their booking page goes public. requireAdmin() gates the
// page, and admin_list_operators self-guards too (it returns nothing to a non-admin).
export default async function AdminOperatorsPage() {
  await requireAdmin();
  const operators = await listOperators();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Operators"
        description="Approve an operator before their booking page goes live — verify they really own the property and that the GCash name matches their identity."
      />
      <div className="flex flex-col gap-3">
        {operators.length === 0 ? (
          <p className="text-body-sm text-muted">No operators yet.</p>
        ) : (
          operators.map((o) => <OperatorRow key={o.tenant_id} op={o} />)
        )}
      </div>
    </div>
  );
}
