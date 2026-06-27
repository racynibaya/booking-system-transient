"use client";

import { Percent } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminGetPayoutRates, adminSetPayoutRate } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

const toPct = (decimal: number) => Number((decimal * 100).toFixed(2)).toString();

export function RateEditor({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null); // null = still loading
  const [commission, setCommission] = useState(""); // percent strings
  const [service, setService] = useState("");
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  function openEditor() {
    setOpen(true);
    setHasAccount(null);
    startLoad(async () => {
      const res = await adminGetPayoutRates(tenantId);
      if (!res.ok) {
        toast.error(res.error);
        setOpen(false);
        return;
      }
      if (!res.rates) {
        setHasAccount(false);
        return;
      }
      setHasAccount(true);
      setCommission(toPct(res.rates.commissionRate));
      setService(toPct(res.rates.serviceFeeRate));
    });
  }

  const cPct = Number(commission);
  const sPct = Number(service);
  const invalid =
    commission.trim() === "" ||
    service.trim() === "" ||
    Number.isNaN(cPct) ||
    Number.isNaN(sPct) ||
    cPct < 0 ||
    cPct > 50 ||
    sPct < 0 ||
    sPct > 50;

  function save() {
    if (invalid) return;
    startSave(async () => {
      const res = await adminSetPayoutRate({
        tenantId,
        commissionRate: cPct / 100,
        serviceFeeRate: sPct / 100,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Rates updated.");
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={openEditor}>
        <Percent className="size-4" /> Rates
      </Button>

      <ConfirmDialog
        open={open}
        title="Set payout rates"
        description="Per-owner commission and guest service fee (e.g. 2.5% commission for an early adopter). Defaults are 5% commission · 6% service fee."
        confirmLabel="Save"
        pending={saving}
        onConfirm={save}
        onCancel={() => setOpen(false)}
      >
        {loading || hasAccount === null ? (
          <p className="text-body-sm text-muted">Loading current rates…</p>
        ) : hasAccount === false ? (
          <p className="rounded-sm border border-hairline bg-surface-soft p-3 text-body-sm text-muted">
            This operator has no payout account yet. They add one in Settings → Get paid before a
            rate can be set.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label>
              <span className="mb-1.5 block text-caption text-muted">Commission rate (%)</span>
              <Input
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                inputMode="decimal"
                placeholder="5"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-caption text-muted">Guest service fee (%)</span>
              <Input
                value={service}
                onChange={(e) => setService(e.target.value)}
                inputMode="decimal"
                placeholder="6"
              />
            </label>
            {invalid && (
              <span className="text-caption-sm text-error" role="alert">
                Enter rates between 0% and 50%.
              </span>
            )}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
