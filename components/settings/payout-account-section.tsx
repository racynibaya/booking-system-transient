"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { listPayoutInstitutions, upsertPayoutAccount } from "@/app/(app)/settings/actions";
import type { ReceivingInstitution } from "@/lib/paymongo/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAYOUT_METHOD_LABELS, PAYOUT_METHODS, type PayoutMethod } from "@/lib/validation";

type PayoutAccount = {
  id: string;
  method: PayoutMethod;
  payout_name: string;
  account_number: string;
  bank_name: string | null;
  payout_bic: string | null;
  status: string;
  updated_at: string;
};

const SELECT_CLASS =
  "w-full rounded-md border border-hairline bg-canvas p-2.5 text-body-sm text-ink outline-none focus-visible:border-primary";

// One payout destination per operator. Controlled form (the Server Action validates). The account
// NAME must match the GCash/bank account exactly or PayMongo rejects the transfer — we warn loudly.
function PayoutForm({ account, onDone }: { account?: PayoutAccount; onDone: () => void }) {
  const [method, setMethod] = useState<PayoutMethod>(account?.method ?? "gcash");
  const [payoutName, setPayoutName] = useState(account?.payout_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [bankBic, setBankBic] = useState(account?.payout_bic ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The bank picker needs the receiving-institution list; load it lazily the first time the operator
  // switches to "bank". GCash needs no picker (resolved server-side to its fixed code).
  const [institutions, setInstitutions] = useState<ReceivingInstitution[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  useEffect(() => {
    if (method !== "bank" || institutions || banksError) return;
    let active = true;
    listPayoutInstitutions().then((res) => {
      if (!active) return;
      if (res.ok) setInstitutions(res.institutions);
      else setBanksError(res.error);
    });
    return () => {
      active = false;
    };
  }, [method, institutions, banksError]);

  async function save() {
    setPending(true);
    setError(null);
    // Carry the chosen institution's display name as bank_name so the saved card reads naturally.
    const bank = institutions?.find((i) => i.bic === bankBic);
    const res = await upsertPayoutAccount({
      method,
      payout_name: payoutName,
      account_number: accountNumber,
      bank_name: bank?.name ?? account?.bank_name ?? "",
      payout_bic: method === "bank" ? bankBic : undefined,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Payout account saved");
    onDone();
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Pay me via">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PayoutMethod)}
          className={SELECT_CLASS}
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYOUT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>

      {method === "bank" && (
        <Field label="Bank">
          {banksError ? (
            <p className="text-body-sm text-error">{banksError}</p>
          ) : !institutions ? (
            <p className="text-body-sm text-muted">Loading banks…</p>
          ) : (
            <select
              value={bankBic}
              onChange={(e) => setBankBic(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Select your bank</option>
              {institutions.map((i) => (
                <option key={i.bic} value={i.bic}>
                  {i.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label="Account name">
        <Input
          value={payoutName}
          onChange={(e) => setPayoutName(e.target.value)}
          placeholder="Juan Dela Cruz"
        />
      </Field>

      <Field label={method === "bank" ? "Account number" : "GCash number"}>
        <Input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder={method === "bank" ? "0000 0000 0000" : "0917 123 4567"}
          inputMode="numeric"
        />
      </Field>

      <p className="text-body-sm text-muted">
        Make sure the account name matches your {method === "bank" ? "bank" : "GCash"} account
        exactly — a mismatch makes payouts fail. Very large payouts can also hit your{" "}
        {method === "bank" ? "bank's" : "GCash"} receiving limit.
      </p>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save payout account"}
        </Button>
        {account && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export function PayoutAccountSection({ account }: { account: PayoutAccount | null }) {
  const [editing, setEditing] = useState(false);

  if (!account || editing) {
    return (
      <Card className="p-4 md:p-5">
        <PayoutForm account={account ?? undefined} onDone={() => setEditing(false)} />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge tone="neutral">{PAYOUT_METHOD_LABELS[account.method]}</Badge>
          <p className="mt-2 text-title-md text-ink">{account.payout_name}</p>
          <p className="text-body-sm text-muted">{account.account_number}</p>
          {account.method === "bank" && account.bank_name && (
            <p className="text-caption text-muted">{account.bank_name}</p>
          )}
        </div>
        <div className="sm:shrink-0">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </div>
      <p className="text-body-sm text-muted">
        We send your share here within ~2 banking days of a guest paying.
      </p>
    </Card>
  );
}
