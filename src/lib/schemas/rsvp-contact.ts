import { z } from 'zod';
import { e164Schema } from './sms';

/**
 * FPP-34: phone + comms consent collected on the RSVP form.
 *
 * Both fields are optional. When a phone is provided we require
 * `smsConsent: true` so the value can flow downstream to Twilio
 * (QUB-8) — the sms-dispatch gate refuses to send without consent,
 * so this is also a data-quality check. When the phone is empty
 * the consent is irrelevant and may be either true or false.
 *
 * The schema is intentionally permissive about the empty case so a
 * user who prefers email can submit the form without making a
 * statement about SMS.
 *
 * Empty-after-trim is the canonical "no phone" form: the input is
 * trimmed so a stray space does not silently keep the row warm.
 */
export const rsvpContactSchema = z
  .object({
    phone: e164Schema.optional().or(z.literal('')),
    smsConsent: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const trimmed = value.phone?.trim() ?? '';
    if (trimmed && value.smsConsent !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['smsConsent'],
        message: 'SMS consent is required to save a phone number',
      });
    }
  });

export type RsvpContactInput = z.infer<typeof rsvpContactSchema>;

/**
 * FPP-34: helper that decides which contact fields to send to
 * `user.updatePreferences` based on the user's existing profile.
 * Centralising the rule keeps the RSVP submit handler free of
 * branching and the wiring testable in isolation.
 *
 * Rules:
 * - When the trimmed phone is empty, we clear both phone and consent
 *   so a user who removes their phone also revokes consent (otherwise
 *   a stale `smsConsent: true` would silently re-enable Twilio).
 * - When the trimmed phone is non-empty, we send phone + consent=true
 *   and only emit a PATCH when something actually changed (either the
 *   phone or the consent). This avoids a needless round-trip when the
 *   user opens the form and submits without typing anything.
 *
 * The patch only carries `phoneNumber` and `smsConsent`. `smsConsentAt`
 * and `smsConsentIp` are written by the server in
 * `user.updatePreferences`, where the actual IP and timestamp come
 * from the request context. The client cannot produce a trustworthy
 * consent timestamp, so we do not try to ship one across the wire.
 */
export interface ContactProfileSnapshot {
  phoneNumber: string | null;
  smsConsent: boolean;
}

export interface ContactPatch {
  phoneNumber?: string | null;
  smsConsent?: boolean;
}

export function diffContact(
  draft: { phone: string; smsConsent: boolean | undefined },
  snapshot: ContactProfileSnapshot,
): ContactPatch {
  const trimmed = draft.phone.trim();
  if (trimmed.length === 0) {
    if (snapshot.phoneNumber === null && !snapshot.smsConsent) return {};
    return {
      phoneNumber: null,
      smsConsent: false,
    };
  }
  // Non-empty path: the schema has already enforced smsConsent=true,
  // so we can treat the field as settled.
  const consent = draft.smsConsent === true;
  const phoneChanged = trimmed !== (snapshot.phoneNumber ?? '');
  const consentChanged = consent !== snapshot.smsConsent;
  if (!phoneChanged && !consentChanged) return {};
  const patch: ContactPatch = {};
  if (phoneChanged) patch.phoneNumber = trimmed;
  if (consentChanged) patch.smsConsent = consent;
  return patch;
}
