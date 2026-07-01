import { ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { relativeDay } from "@/lib/dates";
import { getInquiryThreads, requireUser } from "@/lib/supabase/dal";

// M2 — the operator's inquiry Inbox. Guest questions land here (newest / needs-reply first) so they
// never live in Messenger out of reach. Each row opens the full thread.
export default async function InboxPage() {
  await requireUser();
  const threads = await getInquiryThreads();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inbox"
        description="Guest questions about your places — answer without leaving Tuloy."
      />

      {threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No questions yet"
          description="When a guest asks about one of your listings, the conversation shows up here."
        />
      ) : (
        <Card elevation={1} className="flex flex-col divide-y divide-hairline-soft p-0">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/inbox/${t.id}`}
              className="group flex items-center gap-3 p-4 transition-colors first:rounded-t-md last:rounded-b-md hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-title-sm text-ink">{t.guest_name}</p>
                  {t.awaiting_operator && <Badge tone="warning">Needs reply</Badge>}
                </div>
                <p className="truncate text-caption-sm text-muted">
                  {t.properties?.name ? `${t.properties.name} · ` : ""}
                  {t.lastSender === "operator" ? "You: " : ""}
                  {t.preview}
                </p>
              </div>
              <span className="shrink-0 text-caption-sm text-muted">
                {relativeDay(t.last_message_at.slice(0, 10))}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
