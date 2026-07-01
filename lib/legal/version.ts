// The current version of Tuloy's Terms / operator agreement. Bump this string whenever the Terms
// or the operator agreement change — tenant_consents rows store the version accepted, so comparing a
// stored version to this constant is how we detect who must re-accept. A code constant (not a DB
// table) is the simplest thing that works at pilot scale; add a table only if versions need history.
export const TERMS_VERSION = "2026-07-01";
