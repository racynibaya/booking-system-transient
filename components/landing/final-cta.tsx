import { CtaButton } from "./cta-button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="px-6 pb-24">
      <Reveal className="grain mx-auto max-w-3xl overflow-hidden rounded-xl bg-linear-to-br from-ink via-ink to-sea px-8 py-16 text-center shadow-e3">
        <h2 className="text-display-xl text-balance text-canvas">Ready to stop losing bookings?</h2>
        <p className="mx-auto mt-4 max-w-md text-body-md text-canvas/70">
          Set up your booking page in an afternoon. Free during the pilot — no card, no commission.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton href="/login" variant="invert">
            Get started free
          </CtaButton>
        </div>
      </Reveal>
    </section>
  );
}
