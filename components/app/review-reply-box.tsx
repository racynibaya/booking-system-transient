"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { replyToReview } from "@/app/(app)/reviews/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Operator's public reply composer on a review (S5). Collapsed by default: a "Reply" button when
// there's no reply yet, an "Edit reply" link when one exists. Sends via the RLS-scoped action.
export function ReviewReplyBox({
  reviewId,
  existingReply,
}: {
  reviewId: string;
  existingReply: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(existingReply ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () => {
    start(async () => {
      const res = await replyToReview(reviewId, body);
      if (res.ok) {
        toast.success("Reply saved");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (!open) {
    return existingReply ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md text-caption font-medium text-primary transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      >
        Edit reply
      </button>
    ) : (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        Reply
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a public reply…"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Send className="size-4" /> {pending ? "Saving…" : "Save reply"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpen(false);
            setBody(existingReply ?? "");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
