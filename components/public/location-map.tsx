// Lightweight location map for the public listing. Uses Google Maps' keyless embed keyed off
// the free-text address — approximate, no API key, no stored coordinates. Server-rendered.
export function LocationMap({ address }: { address: string }) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return (
    <div className="overflow-hidden rounded-md border border-hairline shadow-[0_1px_2px_rgba(20,8,12,0.06),0_8px_24px_-12px_rgba(20,8,12,0.18)]">
      <iframe
        title="Map"
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-72 w-full border-0 grayscale-[0.15]"
      />
    </div>
  );
}
