/**
 * Single source of truth for legal-document versions (152-FZ compliance —
 * see D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md §1.1).
 *
 * These are FIXED strings, bumped by hand whenever the corresponding page's
 * legal text materially changes. Previously src/app/privacy/page.tsx and
 * src/app/terms/page.tsx each rendered `new Date().getFullYear()` as the
 * "last updated" version — meaning the displayed version silently changed
 * every January 1st with no corresponding text change, and any consent
 * record referencing "the 2026 version" would point at a moving target
 * (the exact `document_version`/UI-text mismatch the canon calls out as the
 * `ocf` failure mode). Both pages now render these constants directly, and
 * consent_events.document_version is always one of these values — one
 * source of truth for UI and DB.
 */

export const TERMS_VERSION = '2026-08-18'
export const PRIVACY_POLICY_VERSION = '2026-08-18'

/** consent_events.purpose values used on this site (subset of the canon's full enum). */
export type ConsentPurpose = 'terms' | 'privacy_policy' | 'pd_processing_general'

export const CONSENT_DOCUMENT_VERSION: Record<ConsentPurpose, string> = {
  terms: TERMS_VERSION,
  privacy_policy: PRIVACY_POLICY_VERSION,
  // Contact-form / lead consent references the privacy policy's PD-processing
  // section — same document, same version, distinct purpose tag so it is
  // never bundled with the "terms of use" consent (canon §1.1 UI requirement).
  pd_processing_general: PRIVACY_POLICY_VERSION,
}
