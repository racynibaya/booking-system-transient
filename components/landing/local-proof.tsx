import { Reveal } from "./reveal";

const AREAS = ["Monaliza", "Kahuna", "Sebay", "Urbiztondo"];

export function LocalProof() {
  return (
    <section className="border-y border-hairline-soft bg-surface-soft/60 px-6 py-10">
      <Reveal className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center">
        <p className="text-caption text-muted">
          Built for San Juan, La Union — now piloting with local operators this peak season
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {AREAS.map((area) => (
            <span
              key={area}
              className="rounded-full border border-hairline bg-canvas px-4 py-1.5 text-body-sm text-ink"
            >
              {area}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
