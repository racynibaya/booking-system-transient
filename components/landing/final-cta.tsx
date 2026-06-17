import { CtaButton } from "./cta-button";

export function FinalCta() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-3xl rounded-xl bg-ink px-8 py-16 text-center">
        <h2 className="text-display-xl text-balance text-canvas">Ready to stop losing bookings?</h2>
        <p className="mx-auto mt-4 max-w-md text-body-md text-canvas/70">
          Set up your booking page in an afternoon. Free during the pilot — no card, no commission.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton href="#" variant="invert">
            Get started free
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
