// The dashboard's one bold element (everything else stays restful Sea Glass): a deep sea-green
// gradient card answering "am I making money?" at a glance. Collected-this-week is the headline;
// coming-this-month and still-owed sit beneath as translucent sub-tiles. Server component — pure
// display; the owes list (with its actions) is rendered separately below the hero.
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export function MoneyHero({
  collectedThisWeek,
  comingThisMonth,
  owesTotal,
  owesCount,
}: {
  collectedThisWeek: number;
  comingThisMonth: number;
  owesTotal: number;
  owesCount: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-md p-6 text-on-primary shadow-card md:p-7"
      style={{
        background:
          "radial-gradient(130% 150% at 0% 0%, var(--color-sunset-1) 0%, var(--color-primary) 48%, var(--color-sea) 100%)",
      }}
    >
      <p className="text-caption text-on-primary/80">Collected this week</p>
      <p className="mt-1 font-display text-rating-display leading-none tracking-tight">
        {peso(collectedThisWeek)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-sm bg-white/12 px-4 py-3">
          <p className="text-caption-sm text-on-primary/80">Coming this month</p>
          <p className="mt-1 text-display-sm">{peso(comingThisMonth)}</p>
        </div>
        <div className="rounded-sm bg-white/12 px-4 py-3">
          <p className="text-caption-sm text-on-primary/80">Still owed</p>
          <p className="mt-1 text-display-sm">{peso(owesTotal)}</p>
          <p className="mt-0.5 text-caption-sm text-on-primary/70">
            {owesCount === 0 ? "all settled" : `${owesCount} booking${owesCount > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
