// Dashboard greeting — the reference's "Hello X, Good Morning" header, in the owner's voice.
// Time-of-day is computed in Asia/Manila (the audience), not server UTC.
function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting({ name }: { name: string | null }) {
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }).format(new Date()),
  );

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-display-lg text-ink">
        {greetingFor(hour)}, {name ?? "there"}
      </h1>
      <p className="text-body-sm text-muted">Here&rsquo;s how the platform is doing today.</p>
    </div>
  );
}
