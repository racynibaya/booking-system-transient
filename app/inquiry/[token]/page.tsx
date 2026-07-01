import Image from "next/image";
import { notFound } from "next/navigation";

import { GuestReplyBox } from "@/components/public/guest-reply-box";
import { Card } from "@/components/ui/card";
import { formatDateShort } from "@/lib/dates";
import { createServiceClient } from "@/lib/supabase/server";

// M2b — the guest's tokenized thread page. No login: the token in the URL is the credential, read
// through the service-role path. The guest reads the host's reply and can respond, keeping the whole
// conversation inside Tuloy (the email is only a nudge with a link here).
export default async function GuestThreadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createServiceClient();
  const { data } = await admin
    .from("inquiry_threads")
    .select("guest_name, properties(name), inquiry_messages(id, sender, body, created_at)")
    .eq("token", token)
    .maybeSingle();
  if (!data) notFound();

  const messages = [...(data.inquiry_messages ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const propertyName = data.properties?.name ?? "the host";

  return (
    <main className="shell-ambient min-h-dvh">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={64}
            height={34}
            className="h-7 w-auto"
          />
          <h1 className="font-display text-display-sm text-ink">
            Your conversation with {propertyName}
          </h1>
          <p className="text-body-sm text-muted">
            Replies from the host show up here. You can respond any time.
          </p>
        </header>

        <Card elevation={1} className="flex flex-col gap-3 p-5">
          {messages.map((m) => {
            const mine = m.sender === "guest";
            const auto = m.sender === "auto";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-md px-4 py-2.5 text-body-md ${
                    mine
                      ? "bg-primary text-on-primary"
                      : auto
                        ? "bg-surface-strong text-ink"
                        : "bg-surface-soft text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <span className="mt-1 text-caption-sm text-muted">
                  {mine ? "You" : auto ? "Automatic reply" : propertyName} ·{" "}
                  {formatDateShort(m.created_at.slice(0, 10))}
                </span>
              </div>
            );
          })}
        </Card>

        <GuestReplyBox token={token} />
      </div>
    </main>
  );
}
