import { CheckCircle2, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { VerificationUploader } from "@/components/verification/verification-uploader";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

const DOCS = [
  {
    kind: "gov_id",
    label: "Government ID",
    hint: "A clear photo of your valid government-issued ID.",
  },
  {
    kind: "business_permit",
    label: "Business permit / DOT accreditation",
    hint: "Mayor's permit, DTI/BIR registration, or DOT certificate — any one.",
  },
  {
    kind: "property_proof",
    label: "Proof you control the property",
    hint: "A photo taken at the property with your name and today's date written on paper.",
  },
] as const;

export default async function VerificationPage() {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("verification_documents")
    .select("kind")
    .eq("tenant_id", tenant.id);
  const uploaded = new Set((data ?? []).map((d) => d.kind));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification"
        description="Upload these so we can confirm you're a real operator. Your booking page goes live once we approve — usually within a day."
      />

      <div className="rounded-md border border-hairline bg-surface-soft p-4">
        <p className="text-body-sm text-ink">
          <span className="font-medium">Why we verify.</span> It keeps Tuloy trustworthy for
          everyone — it protects guests from fake listings and scammers, and it protects{" "}
          <em>your</em> business from impersonators who copy your property and divert your bookings
          to their own GCash.
        </p>
      </div>

      {tenant.verification_status === "approved" && (
        <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface-soft p-3 text-body-sm text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          Your account is verified — your booking page is live.
        </div>
      )}

      {tenant.verification_status === "changes_requested" && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary-disabled p-3 text-body-sm text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Changes requested:</span>{" "}
            {tenant.verification_note ?? "Please re-upload clearer documents."}
            <br />
            Re-upload below and we&rsquo;ll review again.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {DOCS.map((d) => (
          <VerificationUploader
            key={d.kind}
            tenantId={tenant.id}
            kind={d.kind}
            label={d.label}
            hint={d.hint}
            uploaded={uploaded.has(d.kind)}
          />
        ))}
      </div>

      <p className="text-caption text-muted">
        Your documents are private — only used to verify your account and never shown on your public
        booking page.
      </p>
    </div>
  );
}
