"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { replyToInquiry } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Operator's reply composer (M2). Sends via the RLS-scoped action; on success it clears and
// refreshes so the new message appears in the thread.
export function ReplyBox({ threadId }: { threadId: string }) {
  const [body, setBody] = useState("");
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
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !body.trim()}>
          <Send className="size-4" /> {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
