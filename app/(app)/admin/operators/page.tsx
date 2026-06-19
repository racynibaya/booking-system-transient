import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

import { OperatorRow, type AdminOperator } from "./operator-row";

// Admin-only: approve operators before their booking page goes public. The page is gated on
// is_admin, and admin_list_operators self-guards too (it returns nothing to a non-admin).
export default async function AdminOperatorsPage() {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant?.is_admin) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_operators");
  const operators = (data ?? []) as AdminOperator[];

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
