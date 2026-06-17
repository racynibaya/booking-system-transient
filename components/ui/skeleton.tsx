// Loading placeholder. animate-pulse on a soft surface fill.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-strong ${className}`} />;
}
