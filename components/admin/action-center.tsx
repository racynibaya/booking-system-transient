import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Clock,
  MessageSquareWarning,
  ShieldAlert,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActionBucket, ActionCenter as ActionCenterData } from "@/lib/supabase/admin-dal";

// The signature element of the admin overview: everything that needs the admin right now, ranked by
// severity, in one glance. Each bucket shows its total count plus a few sample rows (who / how stale).
// `href` links buckets whose destination page already exists; buckets without one render inert until
// the target section ships (Finance in Slice 2, Reviews/Inquiries in Slice 5).
type BucketKey = keyof ActionCenterData;

type BucketMeta = {
  key: BucketKey;
  label: string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "error";
  href?: string;
};

// Ordered most-urgent first.
const BUCKETS: BucketMeta[] = [
  {
    key: "failed_payouts",
    label: "Failed payouts",
    icon: AlertTriangle,
    tone: "error",
  },
  {
    key: "pending_kyc",
    label: "Pending verification",
    icon: UserRoundCheck,
    tone: "primary",
    href: "/admin/operators",
  },
  {
    key: "gcash_reverify",
    label: "GCash re-verify",
    icon: ShieldAlert,
    tone: "error",
    href: "/admin/operators",
  },
  {
    key: "aging_inquiries",
    label: "Unanswered 24h+",
    icon: MessageSquareWarning,
    tone: "warning",
  },
  {
    key: "changes_requested",
    label: "Changes requested",
    icon: Clock,
    tone: "warning",
    href: "/admin/operators",
  },
];

const TONES: Record<BucketMeta["tone"], { chip: string; count: string }> = {
  primary: { chip: "bg-primary/15 text-primary", count: "text-primary" },
  warning: { chip: "bg-warning/20 text-warning", count: "text-warning" },
  error: { chip: "bg-error/15 text-error", count: "text-error" },
};

function BucketBlock({ meta, bucket }: { meta: BucketMeta; bucket: ActionBucket }) {
  const t = TONES[meta.tone];
  const Icon = meta.icon;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-md ${t.chip}`}>
          <Icon className="size-4" />
        </span>
        <span className="text-body-sm font-medium text-ink">{meta.label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`text-title-sm tabular-nums ${t.count}`}>{bucket.count}</span>
        {meta.href && (
          <ArrowRight className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-2.5">
      {header}
      {bucket.items.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-hairline-soft pt-2">
          {bucket.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 text-caption">
              <span className="min-w-0 flex-1 truncate font-medium text-body">{item.label}</span>
              <span className="max-w-[55%] min-w-0 shrink truncate text-right text-muted">
                {item.sublabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const base = "rounded-md border border-hairline bg-canvas p-4";
  if (meta.href) {
    return (
      <Link
        href={meta.href}
        className={`group block ${base} transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

export function ActionCenter({ data }: { data: ActionCenterData }) {
  const active = BUCKETS.filter((b) => data[b.key].count > 0);
  const totalOpen = BUCKETS.reduce((sum, b) => sum + data[b.key].count, 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-title-md text-ink">
          <BadgeCheck className="size-4 text-primary" />
          Action center
        </h2>
        {totalOpen > 0 && (
          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-caption-sm font-medium text-primary tabular-nums">
            {totalOpen} open
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="All clear"
          description="Nothing needs you right now — the platform is running clean."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {active.map((meta) => (
            <BucketBlock key={meta.key} meta={meta} bucket={data[meta.key]} />
          ))}
        </div>
      )}
    </Card>
  );
}
