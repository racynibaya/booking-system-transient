import type { ComponentType } from "react";

import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons/social-icons";
import { Card } from "@/components/ui/card";

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
