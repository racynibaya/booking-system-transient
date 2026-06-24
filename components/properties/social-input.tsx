"use client";

import type { ComponentType } from "react";
import { useState } from "react";

import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons/social-icons";

// Seamless social field: the operator types just their handle next to a fixed platform prefix
// (e.g. instagram.com/▮), and we store a full https URL — keeping the data contract (z.url) and the
// public "Follow this place" links unchanged. Pasting a whole URL auto-collapses to the handle.
type Platform = "facebook" | "instagram" | "tiktok";

const CONFIG: Record<
  Platform,
  {
    label: string;
    domain: string;
    at: boolean; // tiktok paths are @handle
    placeholder: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  facebook: {
    label: "Facebook",
    domain: "facebook.com",
    at: false,
    placeholder: "yourpage",
    Icon: FacebookIcon,
  },
  instagram: {
    label: "Instagram",
    domain: "instagram.com",
    at: false,
    placeholder: "yourhandle",
    Icon: InstagramIcon,
  },
  tiktok: {
    label: "TikTok",
    domain: "tiktok.com",
    at: true,
    placeholder: "yourhandle",
    Icon: TikTokIcon,
  },
};

// Reduce any input — bare handle, @handle, or a pasted full URL — to the bare handle. Only
// leading protocol/www/domain/@/slashes and trailing slashes are stripped, so normal typing
// (and internal path segments like facebook.com/pages/X) is preserved.
function toHandle(raw: string, platform: Platform): string {
  const { domain } = CONFIG[platform];
  let h = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  if (h.toLowerCase().startsWith(domain)) h = h.slice(domain.length);
  h = h.replace(/^\/+/, "");
  // Users prepend "@" on any platform; only TikTok's canonical URL keeps it (added back in toUrl).
  h = h.replace(/^@+/, "");
  return h.replace(/\/+$/, "");
}

function toUrl(handle: string, platform: Platform): string {
  const { domain, at } = CONFIG[platform];
  const h = toHandle(handle, platform);
  if (!h) return "";
  return `https://${domain}/${at ? "@" : ""}${h}`;
}

export function SocialField({
  platform,
  defaultUrl,
  onUrlChange,
  error,
}: {
  platform: Platform;
  defaultUrl?: string;
  onUrlChange: (url: string) => void;
  error?: string;
}) {
  const cfg = CONFIG[platform];
  const { Icon } = cfg;
  const [handle, setHandle] = useState(() => toHandle(defaultUrl ?? "", platform));

  function update(raw: string) {
    const cleaned = toHandle(raw, platform);
    setHandle(cleaned);
    onUrlChange(cleaned ? toUrl(cleaned, platform) : "");
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-14 items-center gap-2 rounded-sm border border-hairline bg-canvas px-3.5 transition-colors focus-within:border-2 focus-within:border-ink">
        <Icon className="size-5 shrink-0 text-muted" />
        <span className="shrink-0 text-body-md text-muted-soft select-none">
          {cfg.domain}/{cfg.at ? "@" : ""}
        </span>
        <input
          type="text"
          value={handle}
          onChange={(e) => update(e.target.value)}
          placeholder={cfg.placeholder}
          aria-label={cfg.label}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-body-md text-ink outline-none placeholder:text-muted-soft"
        />
      </div>
      {error && <span className="text-body-sm text-error">{error}</span>}
    </div>
  );
}
