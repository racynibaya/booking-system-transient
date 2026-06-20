"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { connectGateway, disconnectGateway } from "@/app/(app)/settings/gateway-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { GatewayConnectionStatus } from "@/lib/supabase/dal";

function formatConnectedAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// PayMongo connect/disconnect for Business-tier operators. The secret key never round-trips back —
// once connected we only ever show non-secret status. The server action is the validator.
export function GatewaySection({ status }: { status: GatewayConnectionStatus }) {
  const router = useRouter();
  const [sk, setSk] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    if (!sk.trim()) return;
    setPending(true);
    setError(null);
    const res = await connectGateway(sk);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSk("");
    toast.success("PayMongo connected");
    router.refresh();
  }

  async function disconnect() {
    setPending(true);
    const res = await disconnectGateway();
    setPending(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("PayMongo disconnected");
    router.refresh();
  }

  if (status.connected) {
    return (
      <Card className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone="success">Connected</Badge>
            <p className="mt-2 text-title-md text-ink">PayMongo</p>
            {formatConnectedAt(status.updatedAt) && (
              <p className="text-body-sm text-muted">
                Connected {formatConnectedAt(status.updatedAt)}
              </p>
            )}
          </div>
          <div className="sm:shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={confirming}
          title="Disconnect PayMongo?"
          description="Guests will no longer be able to pay online instantly. You can reconnect anytime with your secret key."
          confirmLabel="Disconnect"
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={disconnect}
        />
      </Card>
    );
  }

  return (
    <Card className="flex max-w-md flex-col gap-4 p-4 md:p-5">
      <Field label="PayMongo secret key" error={error ?? undefined}>
        <Input
          type="password"
          value={sk}
          onChange={(e) => setSk(e.target.value)}
          placeholder="sk_live_…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <p className="text-body-sm text-muted">
        Paste the secret key from your PayMongo dashboard. We store it encrypted and never show it
        again — and we set up the payment webhook for you.
      </p>
      <div>
        <Button type="button" disabled={pending || !sk.trim()} onClick={connect}>
          {pending ? "Connecting…" : "Connect PayMongo"}
        </Button>
      </div>
    </Card>
  );
}
