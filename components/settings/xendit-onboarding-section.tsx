"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getXenditEarnings,
  listPayoutChannels,
  startXenditOnboarding,
  submitXenditKyc,
  withdrawXenditBalance,
} from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type XenditAccount = {
  id: string;
  sub_account_id: string;
  type: string;
  kyc_status:
    | "INVITED"
    | "REGISTERED"
    | "AWAITING_DOCS"
    | "PENDING_VERIFICATION"
    | "LIVE"
    | "SUSPENDED";
  commission_rate: number;
  kyc_submitted_at: string | null;
  payout_channel_code: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  updated_at: string;
};

const STATUS: Record<
  XenditAccount["kyc_status"],
  { label: string; tone: "success" | "danger" | "neutral"; note: string }
> = {
  INVITED: { label: "Onboarding", tone: "neutral", note: "Let's get your account verified." },
  REGISTERED: { label: "Under review", tone: "neutral", note: "We're verifying your details." },
  AWAITING_DOCS: { label: "Under review", tone: "neutral", note: "We're verifying your details." },
  PENDING_VERIFICATION: {
    label: "Under review",
    tone: "neutral",
    note: "Your details are being verified — this usually takes a few business days.",
  },
  LIVE: {
    label: "Active",
    tone: "success",
    note: "You can accept guest payments online. Your share is yours to withdraw anytime.",
  },
  SUSPENDED: {
    label: "Suspended",
    tone: "danger",
    note: "Online payments are paused for this account. Please contact support.",
  },
};

const SELECT_CLASS =
  "w-full rounded-md border border-hairline bg-canvas p-2.5 text-body-sm text-ink outline-none focus-visible:border-primary";

// The 7 Sole-Prop KYC documents (must match the server-side KYC_DOC_TYPES). The form field name is
// `doc_<TYPE>`; the action uploads each to Xendit and submits account_verification.
const DOCS: { type: string; label: string }[] = [
  { type: "DTI_CERTIFICATE", label: "DTI Certificate" },
  { type: "BIR_2303", label: "BIR Form 2303" },
  { type: "GOVERNMENT_ID", label: "Government-issued ID" },
  { type: "PROOF_OF_BUSINESS", label: "Proof of business" },
  { type: "BANK_ACCOUNT_PROOF", label: "Bank account proof" },
  { type: "SERVICE_AGREEMENT", label: "Signed Xendit service agreement" },
  { type: "LIVENESS_SELFIE", label: "Selfie holding your ID" },
];

// Collects everything account_verification needs (PH Sole Prop). Uncontrolled <form> → FormData so the
// 7 document files ride along; the server action uploads them and submits.
function KycForm({
  defaults,
  onDone,
}: {
  defaults: { legal_name: string; trading_name: string; email: string };
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<
    { code: string; name: string; category: string }[] | null
  >(null);

  useEffect(() => {
    let active = true;
    listPayoutChannels().then((res) => {
      if (active && res.ok) setChannels(res.channels);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await submitXenditKyc(fd);
      if (res.ok) {
        toast.success("Submitted for verification");
        onDone();
      } else setError(res.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <p className="text-body-sm text-muted">
        Verify your business once so you can accept online payments. We submit everything to our
        payment provider for you — you never need a separate account.
      </p>

      <Field label="Full legal name (as on your ID)">
        <Input name="legal_name" defaultValue={defaults.legal_name} placeholder="Juan Dela Cruz" />
      </Field>
      <Field label="Business / property name (as on your DTI)">
        <Input
          name="trading_name"
          defaultValue={defaults.trading_name}
          placeholder="Seaside Transient"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input name="given_names" placeholder="Juan" />
        </Field>
        <Field label="Last name">
          <Input name="surname" placeholder="Dela Cruz" />
        </Field>
      </div>
      <Field label="Email">
        <Input
          name="email"
          defaultValue={defaults.email}
          placeholder="you@example.com"
          inputMode="email"
        />
      </Field>
      <Field label="Mobile number (optional)">
        <Input name="phone_number" placeholder="0917 123 4567" inputMode="tel" />
      </Field>
      <Field label="Street address">
        <Input name="street_line1" placeholder="Urbiztondo Beach Rd" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City / town">
          <Input name="city" placeholder="San Juan" />
        </Field>
        <Field label="Province">
          <Input name="province_state" defaultValue="La Union" placeholder="La Union" />
        </Field>
      </div>
      <Field label="Postal code">
        <Input name="postal_code" placeholder="2514" inputMode="numeric" />
      </Field>

      <div className="border-t border-hairline pt-4">
        <p className="text-title-md text-ink">Where you get paid</p>
        <p className="mt-0.5 text-body-sm text-muted">
          Your share settles to your account here. You withdraw it anytime, on your own.
        </p>
      </div>
      <Field label="Bank or e-wallet">
        <select name="payout_channel_code" className={SELECT_CLASS} defaultValue="">
          <option value="" disabled>
            {channels ? "Select where to get paid" : "Loading options…"}
          </option>
          {(channels ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Account name (must match exactly)">
        <Input name="payout_account_name" placeholder="Juan Dela Cruz" />
      </Field>
      <Field label="Account / mobile number">
        <Input name="payout_account_number" placeholder="0917 123 4567" inputMode="numeric" />
      </Field>

      <div className="border-t border-hairline pt-4">
        <p className="text-title-md text-ink">Documents</p>
        <p className="mt-0.5 text-body-sm text-muted">Clear photos or PDFs, each under 10MB.</p>
      </div>
      {DOCS.map((doc) => (
        <Field key={doc.type} label={doc.label}>
          <input
            type="file"
            name={`doc_${doc.type}`}
            accept="image/*,application/pdf"
            className="block w-full text-body-sm text-muted file:mr-3 file:rounded-md file:border file:border-hairline file:bg-canvas file:px-3 file:py-1.5 file:text-body-sm file:text-ink"
          />
        </Field>
      ))}

      <label className="flex items-start gap-2 text-body-sm text-muted">
        <input type="checkbox" name="tos_accepted" value="true" className="mt-1" />
        <span>
          I agree to the Tuloy operator agreement. My funds remain mine; Tuloy only moves them to my
          bank when I ask it to.
        </span>
      </label>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Submit for verification
        </Button>
      </div>
    </form>
  );
}

// LIVE operators: show the withdrawable balance + an operator-triggered withdrawal (the custody
// mitigation — the operator instructs the disbursement).
function WithdrawCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const refresh = () => getXenditEarnings().then((res) => setBalance(res.ok ? res.balance : null));
  useEffect(() => {
    refresh();
  }, []);

  const onWithdraw = () =>
    start(async () => {
      const res = await withdrawXenditBalance();
      if (res.ok) {
        toast.success("Withdrawal started — it'll arrive shortly");
        refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <div>
        <p className="text-body-sm text-muted">Available to withdraw</p>
        <p className="text-display-sm text-ink">
          {balance === null ? "—" : `₱${balance.toLocaleString("en-PH")}`}
        </p>
      </div>
      <div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !balance || balance <= 0}
          onClick={onWithdraw}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Withdraw to my bank
        </Button>
      </div>
    </div>
  );
}

export function XenditOnboardingSection({
  account,
  defaults,
}: {
  account: XenditAccount | null;
  defaults: { legal_name: string; trading_name: string; email: string };
}) {
  const [pending, start] = useTransition();
  const [formOpen, setFormOpen] = useState(false);

  const onStart = () =>
    start(async () => {
      const res = await startXenditOnboarding();
      if (res.ok) toast.success("Online payments setup started");
      else toast.error(res.error);
    });

  if (!account) {
    return (
      <Card className="flex max-w-md flex-col gap-4 p-4 md:p-5">
        <p className="text-body-sm text-muted">
          Let guests pay online when they book. We create your secure payment account — your share
          of each booking settles to you directly, and Tuloy only takes its commission at the point
          of payment.
        </p>
        <div>
          <Button type="button" disabled={pending} onClick={onStart}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Set up online payments
          </Button>
        </div>
      </Card>
    );
  }

  const s = STATUS[account.kyc_status];
  const terminal = account.kyc_status === "LIVE" || account.kyc_status === "SUSPENDED";
  const needsKyc = !terminal && !account.kyc_submitted_at;

  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center gap-2">
        <p className="text-title-md text-ink">Online payments</p>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <p className="text-body-sm text-muted">{s.note}</p>

      {account.kyc_status === "LIVE" && <WithdrawCard />}

      {needsKyc &&
        (formOpen ? (
          <div className="border-t border-hairline pt-4">
            <KycForm defaults={defaults} onDone={() => setFormOpen(false)} />
          </div>
        ) : (
          <div>
            <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
              Verify my business
            </Button>
          </div>
        ))}
    </Card>
  );
}
