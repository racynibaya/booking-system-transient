import { ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReplyBox } from "@/components/inbox/reply-box";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateShort } from "@/lib/dates";
import { getInquiryThread, requireUser } from "@/lib/supabase/dal";

// M2 — one inquiry thread. The guest's question + the back-and-forth as chat bubbles (guest left,
// you right), plus the reply composer. Tap-to-call/email the guest from the header.
export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const t = await getInquiryThread(id);
  if (!t) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1 text-body-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Inbox
        </Link>
        <PageHeader
          title={t.guest_name}
          description={t.properties?.name ? `Asking about ${t.properties.name}` : "Guest inquiry"}
          action={t.awaiting_operator ? <Badge tone="warning">Needs reply</Badge> : undefined}
        />
      </div>

      {/* Contact */}
      <div className="flex flex-wrap gap-2">
        {t.guest_email && (
          <a
            href={`mailto:${t.guest_email}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-surface-soft"
          >
            <Mail className="size-4 text-muted" /> {t.guest_email}
          </a>
        )}
        {t.guest_phone && (
          <a
            href={`tel:${t.guest_phone}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-surface-soft"
          >
            <Phone className="size-4 text-muted" /> {t.guest_phone}
          </a>
        )}
      </div>

      {/* Conversation */}
      <Card elevation={1} className="flex flex-col gap-3 p-5">
        {t.messages.map((m) => {
          const mine = m.sender === "operator";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-md px-4 py-2.5 text-body-md ${
                  mine ? "bg-primary text-on-primary" : "bg-surface-soft text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
              <span className="mt-1 text-caption-sm text-muted">
                {mine ? "You" : t.guest_name.split(" ")[0]} ·{" "}
                {formatDateShort(m.created_at.slice(0, 10))}
              </span>
            </div>
          );
        })}
      </Card>

      <ReplyBox threadId={t.id} />
    </div>
  );
}
