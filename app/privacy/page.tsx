import { LegalShell, type LegalSection } from "@/components/legal/legal-shell";
import { TERMS_VERSION } from "@/lib/legal/version";

// Privacy Policy — the Data Privacy Act (R.A. 10173) notice. Tuloy is the Personal Information
// Controller. Content from context/legal-content.md §3. Pilot-grade — final wording is the lawyer's
// call. TODO(Racyn): confirm the real Data Protection Officer contact mailbox below.
const DPO_EMAIL = "privacy@tuloysanjuan.com";
const PART = "Privacy Policy";

const SECTIONS: LegalSection[] = [
  {
    id: "purposes",
    label: "What we use your data for",
    part: PART,
    body: (
      <p>
        Booking fulfillment, payment processing, communicating with you, and complying with our
        legal obligations.
      </p>
    ),
  },
  {
    id: "collected",
    label: "What we collect",
    part: PART,
    body: (
      <>
        <p>
          <strong>Guests:</strong> full name, email address, phone number, and payment details.
          Payment card details are processed by our payment processor (Xendit) and are{" "}
          <strong>not stored by Tuloy</strong>.
        </p>
        <p>
          <strong>Operators:</strong> government-issued ID, DTI registration, BIR registration
          (TIN), and bank or e-wallet (e.g. GCash) details used for payouts.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    label: "Who we share it with",
    part: PART,
    body: (
      <p>
        We share personal data only with: (a) the counterparty to your booking (the Operator or
        Guest, as applicable); (b) Xendit, for payment processing; and (c) government agencies where
        required by law.
      </p>
    ),
  },
  {
    id: "retention",
    label: "How long we keep it",
    part: PART,
    body: (
      <p>
        We retain personal data for approximately three (3) years after your last transaction, or
        longer where required by law.
      </p>
    ),
  },
  {
    id: "rights",
    label: "Your rights",
    part: PART,
    body: (
      <p>
        You may request access to your personal data and correction of any inaccuracies. You may
        also withdraw your consent, though doing so may prevent us from fulfilling bookings.
      </p>
    ),
  },
  {
    id: "dpo",
    label: "Contact — Data Protection Officer",
    part: PART,
    highlight: true,
    body: (
      <p>
        For any privacy request or question, contact our Data Protection Officer at{" "}
        <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How Tuloy collects, uses, and protects your personal data. Tuloy is the Personal Information Controller under the Data Privacy Act of 2012 (R.A. 10173)."
      version={`Version ${TERMS_VERSION} · San Juan, La Union`}
      sections={SECTIONS}
    />
  );
}
