import { LegalShell, type LegalSection } from "@/components/legal/legal-shell";
import { TERMS_VERSION } from "@/lib/legal/version";

// Terms & Conditions — the binding agreement the clickwrap references. Part A = guest terms,
// Part B = the operator agreement (accepted at signup/listing; tenant_consents records the version).
// Content assembled verbatim from context/legal-content.md with the F3 commission fix applied
// (2.5% of the FULL stay, not the guest-paid deposit). Pilot-grade — final wording is the lawyer's call.

const PART_A = "Part A — Guest Terms";
const PART_B = "Part B — Operator Agreement";

const SECTIONS: LegalSection[] = [
  {
    id: "definitions",
    label: "1. Definitions",
    part: PART_A,
    body: (
      <p>
        <strong>Operator</strong> — a person or business that lists and offers accommodation on the
        Platform. <strong>Guest</strong> — a person who books accommodation through the Platform.{" "}
        <strong>Booking</strong> — a confirmed reservation of an Operator&rsquo;s accommodation.{" "}
        <strong>Platform</strong> — the Tuloy website and services. <strong>Sub-Account</strong> —
        the Operator&rsquo;s own account with the Platform&rsquo;s payment processor, into which the
        Operator&rsquo;s funds settle.
      </p>
    ),
  },
  {
    id: "our-role",
    label: "2. Our role as facilitator",
    part: PART_A,
    body: (
      <p>
        Tuloy is a technology platform that connects guests with accommodation operators. Tuloy is
        not a party to any booking contract between the guest and operator, does not own, manage, or
        control any accommodation property, and does not act as a payment intermediary, money
        services provider, or depository institution. Tuloy shall not be liable for any loss,
        damage, delay, or injury arising from the operator&rsquo;s failure to provide the booked
        accommodation, the guest&rsquo;s failure to comply with the operator&rsquo;s policies, or
        any dispute between the operator and guest.
      </p>
    ),
  },
  {
    id: "account-booking",
    label: "3. Account & booking",
    part: PART_A,
    body: (
      <p>
        To make a Booking you agree to provide accurate and complete information. You search for and
        select an Operator&rsquo;s accommodation, and a Booking is formed when it is confirmed on
        the Platform. Tuloy does not guarantee that any Operator will accept a Booking request.
      </p>
    ),
  },
  {
    id: "payment",
    label: "4. Payment",
    part: PART_A,
    body: (
      <p>
        The Guest pays the required deposit online through the Platform&rsquo;s payment processor.
        The Operator&rsquo;s share settles directly into the Operator&rsquo;s own Sub-Account; the
        Platform receives only its commission. Tuloy never holds or takes custody of Guest or
        Operator funds. Any balance beyond the online deposit is payable directly to the Operator as
        stated on the listing.
      </p>
    ),
  },
  {
    id: "cancellations",
    label: "5. Cancellations & refunds",
    part: PART_A,
    body: (
      <p>
        Each Operator sets their own cancellation policy, which is displayed on the Operator&rsquo;s
        listing page and shown on the booking page before you confirm a Booking. A
        &ldquo;non-refundable&rdquo; policy is permitted where expressly stated. Tuloy is not a
        party to, and shall have no liability for, any cancellation, refund, or chargeback between
        the Guest and Operator. See also the Refunds &amp; chargebacks terms in Part B.
      </p>
    ),
  },
  {
    id: "guest-responsibilities",
    label: "6. Guest responsibilities",
    part: PART_A,
    body: (
      <p>
        You agree to provide accurate information, use the Platform lawfully, and not engage in
        fraud or misuse.
      </p>
    ),
  },
  {
    id: "liability",
    label: "7. Limitation of liability",
    part: PART_A,
    body: (
      <p>
        Tuloy is a facilitator and is not liable for an Operator&rsquo;s conduct, the condition or
        availability of any accommodation, booking disputes, or any losses arising from a Booking.
      </p>
    ),
  },
  {
    id: "disclaimers",
    label: "8. Disclaimers",
    part: PART_A,
    body: (
      <p>
        The Platform is provided on an &ldquo;as available&rdquo; basis. Tuloy does not guarantee
        uninterrupted availability of the Platform or the acceptance of any Booking request.
      </p>
    ),
  },
  {
    id: "governing-law",
    label: "9. Governing law",
    part: PART_A,
    body: (
      <p>
        These Terms are governed by the laws of the Republic of the Philippines, including the Civil
        Code and the Consumer Act (R.A. 7394).
      </p>
    ),
  },
  {
    id: "disputes",
    label: "10. Dispute resolution",
    part: PART_A,
    body: (
      <p>
        The parties shall first attempt to resolve any dispute amicably. Failing that, disputes may
        be brought before the appropriate small claims court or through barangay conciliation as
        required by law.
      </p>
    ),
  },
  {
    id: "commission",
    label: "Commission",
    part: PART_B,
    body: (
      <p>
        For each completed Booking, Tuloy shall deduct a commission equal to{" "}
        <strong>2.5% of the total stay value</strong> — the full booking value, comprising both the
        online deposit and any balance payable in cash at check-in. The commission is collected from
        the Guest&rsquo;s online deposit at settlement; the deposit is set such that Tuloy&rsquo;s
        full-stay commission always fits within it. In the managed model, the payment processor
        splits the payment at the Operator&rsquo;s Sub-Account: Tuloy&rsquo;s commission is remitted
        directly to Tuloy and the Operator&rsquo;s net share is credited to their Sub-Account. Tuloy
        shall provide the Operator with a transaction statement showing the total stay value, the
        commission deducted, and the net amount credited.
      </p>
    ),
  },
  {
    id: "refunds",
    label: "Refunds & chargebacks",
    part: PART_B,
    body: (
      <p>
        The Operator acknowledges that all cancellations, refunds, and chargebacks shall be governed
        by the Operator&rsquo;s stated cancellation policy, which must be clearly displayed on the
        Operator&rsquo;s listing page before booking. Tuloy is not liable for any refund or
        chargeback amount. If a chargeback is initiated by the Guest&rsquo;s bank, Tuloy shall
        cooperate with the payment processor and the Operator to provide transaction records, but
        the Operator bears ultimate liability for any chargeback amount deducted by the payment
        processor.
      </p>
    ),
  },
  {
    id: "fund-control",
    label: "Sub-Account & fund control",
    part: PART_B,
    highlight: true,
    body: (
      <>
        <p>The Operator acknowledges and agrees that:</p>
        <p>
          (a) the Operator owns their own payment Sub-Account with the Platform&rsquo;s payment
          processor; (b) Operator funds settle directly into the Operator&rsquo;s Sub-Account and
          never pass through Tuloy&rsquo;s bank account or balance; (c) Tuloy has no custody,
          control, or access to Operator funds at any time; and (d) the Operator is solely
          responsible for monitoring and withdrawing their own funds.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    label: "Representations & warranties",
    part: PART_B,
    body: (
      <>
        <p>The Operator represents and warrants that:</p>
        <p>
          (a) they have the legal right to list, offer, and book the accommodation property; (b)
          they are duly authorized to enter into booking agreements with Guests; (c) all information
          provided to Tuloy (including property details, pricing, and availability) is accurate and
          not misleading; and (d) they will comply with all applicable laws, including local
          ordinances on transient accommodation, BIR registration, and consumer protection. The
          Operator is responsible for their own BIR registration and for issuing official receipts
          for their accommodation revenue.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      subtitle="Tuloy connects guests with accommodation operators in San Juan, La Union. Tuloy is a technology facilitator — not a party to any booking, and never a holder of your money."
      version={`Version ${TERMS_VERSION} · Governed by the laws of the Republic of the Philippines`}
      sections={SECTIONS}
    />
  );
}
