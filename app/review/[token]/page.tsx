import Image from "next/image";
import { notFound } from "next/navigation";

import { ReviewForm } from "@/components/public/review-form";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { createServiceClient } from "@/lib/supabase/server";

// S5 — the guest's tokenized review page. No login: the token in the URL is the credential, read
// through the service-role path (same idiom as the inquiry thread page). Before submit it shows the
// form; after submit it shows the live review (and the host's reply, if any).
export default async function GuestReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createServiceClient();
  const { data } = await admin
    .from("reviews")
    .select("guest_name, rating, comment, operator_reply, submitted_at, properties(name)")
    .eq("token", token)
    .maybeSingle();
  if (!data) notFound();

  const propertyName = data.properties?.name ?? "your stay";
  const submitted = !!data.submitted_at;

  return (
    <main className="shell-ambient min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <header className="flex flex-col gap-3">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={64}
            height={34}
            className="h-7 w-auto"
          />
          <h1 className="font-display text-display-sm text-ink lg:text-display-xl lg:leading-tight">
            {submitted
              ? `Thanks for reviewing ${propertyName}`
              : `How was your stay at ${propertyName}?`}
          </h1>
          <p className="text-body-md text-muted lg:max-w-sm">
            {submitted
              ? "Your review is now live on the listing."
              : "Share a rating and a few words to help other guests."}
          </p>
        </header>

        <Card elevation={1} className="flex flex-col gap-4 p-6">
          {submitted ? (
            <div className="flex flex-col gap-3">
              <StarRating value={data.rating ?? 0} starClassName="size-6" />
              {data.comment && (
                <p className="text-body-md whitespace-pre-wrap text-ink">{data.comment}</p>
              )}
              {data.operator_reply && (
                <div className="rounded-md bg-surface-soft p-3">
                  <p className="text-caption text-muted">Reply from {propertyName}</p>
                  <p className="mt-1 text-body-sm whitespace-pre-wrap text-ink">
                    {data.operator_reply}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <ReviewForm token={token} />
          )}
        </Card>
      </div>
    </main>
  );
}
