// Pure parser for the PayMongo batch-transfer callback body — NO `server-only` import, so it stays
// unit-testable (same as ./event.ts and ./signature.ts). Framework-free (architecture P6).
//
// The callback is only a WAKE-UP TRIGGER: all we need from it is the transfer id (to re-fetch the
// authoritative status) and our reference_number (= the payout_id we minted). We never trust a status
// in the body. ⚠️ Field paths are best-effort and must be confirmed against a real Money Movement
// callback; the parser looks in a couple of plausible locations and returns nulls when absent.

export type TransferCallbackEvent = {
  data?: {
    id?: string;
    attributes?: {
      reference_number?: string;
      data?: {
        id?: string;
        attributes?: { reference_number?: string };
      };
    };
  };
  // Some callbacks deliver a flat transfer object rather than the data-envelope.
  id?: string;
  reference_number?: string;
};

export type ParsedTransferCallback = {
  transferId: string | null;
  payoutId: string | null; // our reference_number
};

export function parseTransferCallback(event: TransferCallbackEvent): ParsedTransferCallback {
  const resource = event.data?.attributes?.data;
  const transferId = resource?.id ?? event.data?.id ?? event.id ?? null;
  const payoutId =
    resource?.attributes?.reference_number ??
    event.data?.attributes?.reference_number ??
    event.reference_number ??
    null;
  return { transferId, payoutId };
}
