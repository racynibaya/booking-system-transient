"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deletePaymentMethod, upsertPaymentMethod } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_TYPES,
  type PaymentMethodType,
} from "@/lib/validation";

import { PaymentQrUploader } from "./payment-qr-uploader";

type Method = {
  id: string;
  type: PaymentMethodType;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  qr_path: string | null;
  sort_order: number;
};

const SELECT_CLASS =
  "w-full rounded-md border border-hairline bg-canvas p-2.5 text-body-sm text-ink outline-none focus-visible:border-primary";

// Add/edit form for one method. Controlled (the Server Action is the validator — it returns the
// field error); kept simple over react-hook-form because the bank-name field is conditional.
function MethodForm({ method, onDone }: { method?: Method; onDone: () => void }) {
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? "gcash");
  const [accountName, setAccountName] = useState(method?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(method?.account_number ?? "");
  const [bankName, setBankName] = useState(method?.bank_name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await upsertPaymentMethod({
      id: method?.id,
      type,
      account_name: accountName,
      account_number: accountNumber,
      bank_name: bankName,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(method ? "Payment method updated" : "Payment method added");
    onDone();
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PaymentMethodType)}
          className={SELECT_CLASS}
        >
          {PAYMENT_METHOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAYMENT_METHOD_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      {type === "bank" && (
        <Field label="Bank name">
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BPI" />
        </Field>
      )}

      <Field label="Account name">
        <Input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Juan Dela Cruz"
        />
      </Field>

      <Field label={type === "bank" ? "Account number" : "Mobile number"}>
        <Input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder={type === "bank" ? "0000 0000 0000" : "0917 123 4567"}
          inputMode="numeric"
        />
      </Field>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : method ? "Save changes" : "Add method"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PaymentMethodsSection({
  methods,
  tenantId,
}: {
  methods: Method[];
  tenantId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove(id: string) {
    setPending(true);
    const res = await deletePaymentMethod(id);
    setPending(false);
    setRemoveId(null);
    if (!res.ok) toast.error(res.error);
    else toast.success("Payment method removed");
  }

  return (
    <div className="flex flex-col gap-4">
      {methods.length === 0 && !adding && (
        <p className="text-body-sm text-muted">
          No payment methods yet. Add at least one so guests can pay their deposit.
        </p>
      )}

      {methods.map((m) => (
        <Card key={m.id} className="flex flex-col gap-4 p-4 md:p-5">
          {editingId === m.id ? (
            <MethodForm method={m} onDone={() => setEditingId(null)} />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <PaymentQrUploader tenantId={tenantId} methodId={m.id} currentPath={m.qr_path} />
                <div className="min-w-0">
                  <Badge tone="neutral">{PAYMENT_METHOD_LABELS[m.type]}</Badge>
                  <p className="mt-2 text-title-md text-ink">{m.account_name ?? "—"}</p>
                  <p className="text-body-sm text-muted">{m.account_number ?? "—"}</p>
                  {m.type === "bank" && m.bank_name && (
                    <p className="text-caption text-muted">{m.bank_name}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setEditingId(m.id)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoveId(m.id)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {adding ? (
        <Card className="p-4 md:p-5">
          <MethodForm onDone={() => setAdding(false)} />
        </Card>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add payment method
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={removeId !== null}
        title="Remove this payment method?"
        description="Guests will no longer see it as a way to pay their deposit."
        confirmLabel="Remove"
        pending={pending}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => removeId && remove(removeId)}
      />
    </div>
  );
}
