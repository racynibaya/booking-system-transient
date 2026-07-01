// Reviewer avatar (S5). The product has no guest photos, so we render an on-brand sea-tinted disc
// with the guest's initials — a visual anchor for each review card. Decorative; the name is
// announced by the adjacent text.
export function AvatarInitials({
  name,
  className = "size-10 text-body-sm",
}: {
  name: string;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${className}`}
    >
      {initials}
    </span>
  );
}
