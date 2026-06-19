import type { ComponentType } from "react";

import { Card } from "@/components/ui/card";

// Inline brand glyphs — lucide 1.x dropped brand icons and we don't want a new icon dependency.
// All use currentColor so they inherit the link's text color.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v.901h3.997l-.354 2.323-.359 1.343h-3.284v7.98H9.101z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3c-1.36.09-3.24-.6-3.24-1.48z" />
    </svg>
  );
}

type Social = { href: string; label: string; Icon: ComponentType<{ className?: string }> };

export function SocialLinks({
  facebook,
  instagram,
  tiktok,
  propertyName,
}: {
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  propertyName: string;
}) {
  const links: Social[] = [
    { href: facebook ?? "", label: "Facebook", Icon: FacebookIcon },
    { href: instagram ?? "", label: "Instagram", Icon: InstagramIcon },
    { href: tiktok ?? "", label: "TikTok", Icon: TikTokIcon },
  ].filter((l) => l.href.trim() !== "");

  if (links.length === 0) return null;

  return (
    <Card className="p-5">
      <p className="text-title-md font-semibold text-ink">Follow this place</p>
      <p className="mt-1 text-body-sm text-muted">Stay in the loop with {propertyName}.</p>
      <div className="mt-4 flex gap-2.5">
        {links.map(({ href, label, Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${propertyName} on ${label}`}
            className="flex size-11 items-center justify-center rounded-full border border-hairline bg-surface-soft text-ink transition-[background-color,color,transform] hover:bg-primary hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          >
            <Icon className="size-5" />
          </a>
        ))}
      </div>
    </Card>
  );
}
