"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

// Glass variant of ShareLinkButton for the dark command deck — same hand-off behavior (native share
// sheet on phones, copy-link elsewhere), styled to read on the sea gradient instead of the canvas.
export function DeckShareButton({ slug, name }: { slug: string; name: string }) {
  async function onShare() {
    const url = `${window.location.origin}/${slug}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
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
    <button
      type="button"
      onClick={onShare}
      className="edge-highlight inline-flex h-10 items-center gap-2 rounded-sm border border-white/25 bg-white/5 px-4 text-button-sm text-on-primary backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
    >
      <Share2 className="size-4" /> Share
    </button>
  );
}
