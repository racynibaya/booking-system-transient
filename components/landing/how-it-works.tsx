import { CheckCheck, LayoutDashboard, Share2, type LucideIcon } from "lucide-react";

const STEPS: { n: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: "1",
    icon: LayoutDashboard,
    title: "Set up your rooms & calendar",
    body: "Add your rooms, photos, and prices once. Block the dates you're not available.",
  },
  {
    n: "2",
    icon: Share2,
    title: "Share your Tuloy link",
    body: "Drop your booking link in your Facebook page, bio, and every reply.",
  },
  {
    n: "3",
    icon: CheckCheck,
    title: "Guests book & pay the deposit",
    body: "They pick dates, pay a GCash deposit, and you just tap confirm.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-soft/60 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-display-lg text-balance text-ink">Live in an afternoon</h2>
          <p className="mt-4 text-body-md text-body">
            No website to build, no app for your guests to download. Three steps and your Facebook
            page takes real bookings.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="relative rounded-md border border-hairline bg-canvas p-6 shadow-card"
            >
              <span className="absolute top-6 right-6 text-display-md text-hairline">{n}</span>
              <span className="flex size-11 items-center justify-center rounded-full bg-ink text-canvas">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-title-md text-ink">{title}</h3>
              <p className="mt-2 text-body-sm text-body">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
