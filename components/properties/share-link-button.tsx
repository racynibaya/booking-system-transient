"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// Lets an operator hand off their public booking page link. On phones (where they post to
// Messenger/FB/Viber) the OS share sheet opens; everywhere else it copies the link + toasts.
// URL is built from window.location.origin at click time, so it's correct for whatever host
// the app is actually served on — no hardcoded domain.
export function ShareLinkButton({ slug, name }: { slug: string; name: string }) {
  async function onShare() {
    const url = `${window.location.origin}/${slug}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (err) {
        // User dismissed the sheet — not an error, just stop.
        if (err instanceof Error && err.name === "AbortError") return;
        // Anything else: fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={onShare}>
      <Share2 className="size-4" /> Share
    </Button>
  );
}
