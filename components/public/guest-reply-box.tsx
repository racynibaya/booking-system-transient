"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { postGuestMessage } from "@/app/inquiry/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Guest's reply composer on the tokenized thread page (M2b).
export function GuestReplyBox({ token }: { token: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = () => {
    if (!body.trim()) return;
    start(async () => {
      const res = await postGuestMessage(token, body);
      if (res.ok) {
        setBody("");
        toast.success("Message sent");
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
        placeholder="Write a message…"
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !body.trim()}>
          <Send className="size-4" /> {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
