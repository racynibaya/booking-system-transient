"use client";

import { MessageSquareText, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { replyToInquiry } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Template = { id: string; title: string; body: string };

// Operator's reply composer (M2). Sends via the RLS-scoped action; on success it clears and
// refreshes so the new message appears in the thread. S3: drop in a saved reply, then edit + send.
export function ReplyBox({ threadId, templates }: { threadId: string; templates: Template[] }) {
  const [body, setBody] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = () => {
    if (!body.trim()) return;
    start(async () => {
      const res = await replyToInquiry(threadId, body);
      if (res.ok) {
        setBody("");
        toast.success("Reply sent");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply…"
        rows={3}
      />
      <div className="flex items-center justify-between gap-2">
        {templates.length > 0 ? (
          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
            >
              <MessageSquareText className="size-4" /> Saved replies
            </Button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="absolute bottom-full z-20 mb-2 max-h-72 w-72 overflow-auto rounded-md border border-hairline bg-canvas p-1 shadow-e3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setBody((b) => (b.trim() ? `${b}\n${t.body}` : t.body));
                        setMenuOpen(false);
                      }}
                      className="block w-full rounded-sm px-3 py-2 text-left transition-colors hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-none"
                    >
                      <span className="block text-body-sm font-medium text-ink">{t.title}</span>
                      <span className="block truncate text-caption-sm text-muted">{t.body}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span />
        )}

        <Button type="submit" disabled={pending || !body.trim()}>
          <Send className="size-4" /> {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
