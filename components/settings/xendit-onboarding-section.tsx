"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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

// The wizard's four chapters. Keeping the long KYC form as four short, finishable steps is the whole
// point — each screen feels small, the stepper shows the end is near, and momentum carries the
// operator through. The required-field lists gate "Continue"; the server action stays the validator.
const STEPS = [
  { title: "About you", subtitle: "Your details, as they appear on your ID and DTI.", icon: User },
  {
    title: "Where you get paid",
    subtitle: "Your share settles here. Withdraw anytime, on your own.",
    icon: Wallet,
  },
  { title: "Your documents", subtitle: "Clear photos or PDFs, each under 10MB.", icon: FileText },
  { title: "Review & submit", subtitle: "One last look before we verify you.", icon: BadgeCheck },
] as const;

const REQUIRED: string[][] = [
  [
    "legal_name",
    "trading_name",
    "given_names",
    "surname",
    "email",
    "street_line1",
    "city",
    "province_state",
    "postal_code",
  ],
  ["payout_channel_code", "payout_account_name", "payout_account_number"],
  DOCS.map((d) => `doc_${d.type}`),
  [],
];

const LAST = STEPS.length - 1;

// One-shot, sea-toned confetti on the final submit — the single celebratory beat in an otherwise
// quiet flow. Web Animations API so it needs no CSS keyframe; bails out under reduced-motion.
function burst(host: HTMLElement) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#2c7a6b", "#0e8c8c", "#e0a33e", "#1f6f78"];
  for (let i = 0; i < 20; i++) {
    const piece = document.createElement("span");
    piece.style.cssText = `position:absolute;left:50%;top:38%;width:8px;height:8px;border-radius:9999px;background:${colors[i % colors.length]};pointer-events:none;will-change:transform,opacity;`;
    host.appendChild(piece);
    const dx = (Math.random() - 0.5) * 360;
    const dy = -(70 + Math.random() * 200);
    const rot = Math.random() * 540;
    piece
      .animate(
        [
          { transform: "translate(-50%,-50%) translate(0,0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot}deg)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 600, easing: "cubic-bezier(0.22,1,0.36,1)" },
      )
      .addEventListener("finish", () => piece.remove());
  }
}

// Coastal stepper — a tide line that fills sea-green as you advance. Completed nodes carry a check
// and stay tappable (jump back); upcoming nodes sit on the hairline. Labels show from sm up.
function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <div className="relative">
      <div className="absolute inset-x-4 top-4 h-0.5 rounded-full bg-hairline" aria-hidden />
      <div
        className="absolute top-4 left-4 h-0.5 rounded-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `calc((100% - 2rem) * ${step / LAST})` }}
        aria-hidden
      />
      <ol className="relative flex justify-between">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.title} className="flex min-w-0 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => i < step && onJump(i)}
                disabled={i >= step}
                aria-current={active ? "step" : undefined}
                className={`flex size-8 items-center justify-center rounded-full border text-caption transition-colors duration-200 ${
                  done
                    ? "border-primary bg-primary text-on-primary"
                    : active
                      ? "border-primary bg-canvas text-primary ring-4 ring-primary/12"
                      : "border-hairline bg-canvas text-muted-soft"
                } ${i < step ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
              >
                {done ? (
                  <Check className="size-4 motion-safe:animate-card-rise" strokeWidth={2.5} />
                ) : (
                  i + 1
                )}
              </button>
              <span
                className={`hidden truncate text-caption sm:block sm:max-w-[16ch] lg:max-w-[22ch] ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {s.title}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Sticky right rail (desktop) — turns the empty right half into guidance: a live checklist, a
// payout preview that fills in as they type, and the custody reassurance that makes a money form
// feel safe. Presentational; reads the same live snapshot the review step does.
function SideRail({
  step,
  complete,
  channelName,
  accountName,
  accountNumber,
}: {
  step: number;
  complete: boolean[];
  channelName: string | null;
  accountName: string;
  accountNumber: string;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 flex flex-col gap-4">
        <Card elevation={1} className="flex flex-col gap-3 p-4">
          <p className="text-caption text-muted">Your progress</p>
          <ol className="flex flex-col gap-2.5">
            {STEPS.map((s, i) => {
              const done = complete[i];
              const active = i === step;
              return (
                <li key={s.title} className="flex items-center gap-2.5">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                      done
                        ? "bg-primary text-on-primary"
                        : active
                          ? "border border-primary text-primary"
                          : "border border-hairline text-muted-soft"
                    }`}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span
                    className={`text-body-sm ${active ? "text-ink" : done ? "text-body" : "text-muted"}`}
                  >
                    {s.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        {(channelName || accountName) && (
          <Card elevation={1} className="flex flex-col gap-2 p-4">
            <p className="text-caption text-muted">You get paid to</p>
            <div className="flex items-center gap-2.5">
              <IconChip icon={Wallet} tone="success" />
              <div className="min-w-0">
                <p className="truncate text-title-sm text-ink">{accountName || "—"}</p>
                <p className="truncate text-body-sm text-muted">
                  {channelName ?? "Choose a bank or e-wallet"}
                  {accountNumber ? ` · ${accountNumber}` : ""}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-start gap-2.5 rounded-md bg-sea/8 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sea" />
          <p className="text-body-sm text-body">
            Your money stays yours. Tuloy only moves it to your account when you ask — and only
            takes its commission at the point of payment.
          </p>
        </div>
      </div>
    </aside>
  );
}

// The wizard. Every field lives in ONE <form> at all times — inactive steps are hidden, never
// unmounted — so the 7 uncontrolled file inputs keep their selections and the final FormData is
// identical to the old single-page form. Per-step "Continue" only gates emptiness; submitXenditKyc
// remains the real validator.
function KycWizard({
  defaults,
  onDone,
  onCancel,
}: {
  defaults: { legal_name: string; trading_name: string; email: string };
  onCancel: () => void;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tosError, setTosError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<
    { code: string; name: string; category: string }[] | null
  >(null);

  // Live snapshot of string fields + selected document filenames, so the rail, the checklist ticks,
  // and the review step update as the operator types.
  const [snap, setSnap] = useState<Record<string, string>>({});
  const [docNames, setDocNames] = useState<Record<string, string>>({});

  const sync = () => {
    const form = formRef.current;
    if (!form) return;
    const next: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string") next[k] = v;
    const files: Record<string, string> = {};
    for (const d of DOCS) {
      const el = form.elements.namedItem(`doc_${d.type}`) as HTMLInputElement | null;
      if (el?.files?.length) files[d.type] = el.files[0].name;
    }
    setSnap(next);
    setDocNames(files);
  };

  useEffect(() => {
    sync();
    let active = true;
    listPayoutChannels().then((res) => {
      if (active && res.ok) setChannels(res.channels);
    });
    return () => {
      active = false;
    };
  }, []);

  const readField = (name: string) => {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    return el?.value?.trim() ?? "";
  };
  const hasFile = (type: string) =>
    ((formRef.current?.elements.namedItem(`doc_${type}`) as HTMLInputElement | null)?.files
      ?.length ?? 0) > 0;

  const missingFor = (i: number) =>
    REQUIRED[i].filter((name) =>
      name.startsWith("doc_") ? !hasFile(name.slice(4)) : !readField(name),
    );

  // Live completion (snapshot-driven) for the rail + stepper ticks.
  const complete = REQUIRED.map((names, i) =>
    i === LAST
      ? false
      : names.every((name) =>
          name.startsWith("doc_") ? !!docNames[name.slice(4)] : !!snap[name]?.trim(),
        ),
  );

  const validateStep = (i: number) => {
    const missing = missingFor(i);
    setErrors(Object.fromEntries(missing.map((n) => [n, "Please fill this in."])));
    if (missing.length) {
      (formRef.current?.elements.namedItem(missing[0]) as HTMLElement | null)?.focus?.();
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setErrors({});
    setStep((s) => Math.min(s + 1, LAST));
  };
  const back = () => {
    if (step === 0) return onCancel();
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };
  const jump = (i: number) => {
    setErrors({});
    setStep(i);
  };

  const submit = () => {
    for (let i = 0; i < REQUIRED.length; i++) {
      if (missingFor(i).length) {
        setStep(i);
        validateStep(i);
        return;
      }
    }
    const tos = (formRef.current?.elements.namedItem("tos_accepted") as HTMLInputElement | null)
      ?.checked;
    if (!tos) {
      setTosError(true);
      return;
    }
    setTosError(false);
    const fd = new FormData(formRef.current!);
    start(async () => {
      setError(null);
      const res = await submitXenditKyc(fd);
      if (res.ok) {
        if (burstRef.current) burst(burstRef.current);
        toast.success("Submitted for verification");
        window.setTimeout(onDone, 1100);
      } else {
        setError(res.error);
      }
    });
  };

  const channelName = channels?.find((c) => c.code === snap.payout_channel_code)?.name ?? null;
  const StepIcon = STEPS[step].icon;

  return (
    <Card
      elevation={2}
      className="relative overflow-hidden p-5 md:p-7"
      role="group"
      aria-label="Verify your business"
    >
      <div ref={burstRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />

      <Stepper step={step} onJump={jump} />

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_300px]">
        <form
          ref={formRef}
          onInput={sync}
          onChange={sync}
          onSubmit={(e) => e.preventDefault()}
          className="min-w-0"
        >
          {/* Step header — animates on each entry (motion-safe). */}
          <div key={step} className="motion-safe:animate-card-rise">
            <div className="flex items-center gap-2.5">
              <IconChip icon={StepIcon} tone="sea" size="lg" />
              <div>
                <h3 className="font-display text-display-sm text-ink">{STEPS[step].title}</h3>
                <p className="text-body-sm text-muted">{STEPS[step].subtitle}</p>
              </div>
            </div>
          </div>

          {/* All panels stay mounted; only the active one shows. */}
          <div className="mt-6">
            {/* Step 1 — About you */}
            <div hidden={step !== 0} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Full legal name (as on your ID)" error={errors.legal_name}>
                  <Input
                    name="legal_name"
                    defaultValue={defaults.legal_name}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Business / property name (as on your DTI)"
                  error={errors.trading_name}
                >
                  <Input
                    name="trading_name"
                    defaultValue={defaults.trading_name}
                    placeholder="Seaside Transient"
                  />
                </Field>
              </div>
              <Field label="First name" error={errors.given_names}>
                <Input name="given_names" placeholder="Juan" autoComplete="given-name" />
              </Field>
              <Field label="Last name" error={errors.surname}>
                <Input name="surname" placeholder="Dela Cruz" autoComplete="family-name" />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  name="email"
                  defaultValue={defaults.email}
                  placeholder="you@example.com"
                  inputMode="email"
                  autoComplete="email"
                />
              </Field>
              <Field label="Mobile number (optional)">
                <Input
                  name="phone_number"
                  placeholder="0917 123 4567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Street address" error={errors.street_line1}>
                  <Input
                    name="street_line1"
                    placeholder="Urbiztondo Beach Rd"
                    autoComplete="address-line1"
                  />
                </Field>
              </div>
              <Field label="City / town" error={errors.city}>
                <Input name="city" placeholder="San Juan" autoComplete="address-level2" />
              </Field>
              <Field label="Province" error={errors.province_state}>
                <Input name="province_state" defaultValue="La Union" placeholder="La Union" />
              </Field>
              <Field label="Postal code" error={errors.postal_code}>
                <Input name="postal_code" placeholder="2514" inputMode="numeric" />
              </Field>
            </div>

            {/* Step 2 — Where you get paid */}
            <div hidden={step !== 1} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Bank or e-wallet" error={errors.payout_channel_code}>
                  <Select name="payout_channel_code" defaultValue="">
                    <option value="" disabled>
                      {channels ? "Select where to get paid" : "Loading options…"}
                    </option>
                    {(channels ?? []).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Account name (must match exactly)" error={errors.payout_account_name}>
                <Input name="payout_account_name" placeholder="Juan Dela Cruz" />
              </Field>
              <Field label="Account / mobile number" error={errors.payout_account_number}>
                <Input
                  name="payout_account_number"
                  placeholder="0917 123 4567"
                  inputMode="numeric"
                />
              </Field>
            </div>

            {/* Step 3 — Documents */}
            <div hidden={step !== 2} className="grid gap-3 sm:grid-cols-2">
              {DOCS.map((doc) => {
                const fileName = docNames[doc.type];
                const missing = !!errors[`doc_${doc.type}`];
                return (
                  <label
                    key={doc.type}
                    className={`group flex cursor-pointer items-center gap-3 rounded-md border bg-canvas p-3 transition-colors duration-150 focus-within:border-primary hover:border-primary/50 ${
                      fileName
                        ? "border-success/40 bg-success-bg/30"
                        : missing
                          ? "border-error/50"
                          : "border-hairline"
                    }`}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                        fileName ? "bg-success/12 text-success" : "bg-surface-soft text-muted"
                      }`}
                    >
                      {fileName ? (
                        <Check className="size-4.5" strokeWidth={2.5} />
                      ) : (
                        <Upload className="size-4.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm text-ink">{doc.label}</span>
                      <span className="block truncate text-caption text-muted">
                        {fileName ?? "Photo or PDF, under 10MB"}
                      </span>
                    </span>
                    <input
                      type="file"
                      name={`doc_${doc.type}`}
                      accept="image/*,application/pdf"
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>

            {/* Step 4 — Review & submit */}
            <div hidden={step !== 3} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card elevation={1} className="flex flex-col gap-1 p-4">
                  <p className="text-caption text-muted">Your details</p>
                  <p className="text-title-sm text-ink">{snap.legal_name || "—"}</p>
                  <p className="text-body-sm text-muted">{snap.trading_name || "—"}</p>
                  <p className="text-body-sm text-muted">{snap.email || "—"}</p>
                  <p className="text-body-sm text-muted">
                    {[snap.city, snap.province_state].filter(Boolean).join(", ") || "—"}
                  </p>
                </Card>
                <Card elevation={1} className="flex flex-col gap-1 p-4">
                  <p className="text-caption text-muted">You get paid to</p>
                  <p className="text-title-sm text-ink">{snap.payout_account_name || "—"}</p>
                  <p className="text-body-sm text-muted">{channelName ?? "—"}</p>
                  <p className="text-body-sm text-muted">{snap.payout_account_number || "—"}</p>
                </Card>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-surface-soft px-3.5 py-3">
                <BadgeCheck className="size-4 shrink-0 text-success" />
                <p className="text-body-sm text-body">
                  {Object.keys(docNames).length} of {DOCS.length} documents attached
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-body-sm text-body">
                <input
                  type="checkbox"
                  name="tos_accepted"
                  value="true"
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                  onChange={(e) => e.target.checked && setTosError(false)}
                />
                <span>
                  I agree to the Tuloy operator agreement. My funds remain mine; Tuloy only moves
                  them to my bank when I ask it to.
                </span>
              </label>
              {tosError && (
                <p className="text-body-sm text-error">
                  Please agree to the operator agreement to continue.
                </p>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-body-sm text-error">{error}</p>}

          {/* Step controls */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-hairline pt-5">
            <Button type="button" variant="ghost" onClick={back} disabled={pending}>
              {step === 0 ? (
                "Cancel"
              ) : (
                <>
                  <ArrowLeft className="size-4" /> Back
                </>
              )}
            </Button>
            {step < LAST ? (
              <Button type="button" onClick={next}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Submit for verification
              </Button>
            )}
          </div>
        </form>

        <SideRail
          step={step}
          complete={complete}
          channelName={channelName}
          accountName={snap.payout_account_name ?? ""}
          accountNumber={snap.payout_account_number ?? ""}
        />
      </div>
    </Card>
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
      <Card elevation={1} className="flex max-w-xl flex-col gap-4 p-5">
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

  if (needsKyc && formOpen) {
    return (
      <KycWizard
        defaults={defaults}
        onCancel={() => setFormOpen(false)}
        onDone={() => setFormOpen(false)}
      />
    );
  }

  return (
    <Card elevation={1} className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-center gap-2">
        <p className="text-title-md text-ink">Online payments</p>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <p className="text-body-sm text-muted">{s.note}</p>

      {account.kyc_status === "LIVE" && <WithdrawCard />}

      {needsKyc && (
        <div>
          <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
            Verify my business
          </Button>
        </div>
      )}
    </Card>
  );
}
