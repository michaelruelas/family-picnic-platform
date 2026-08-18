import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export type AnalyticsEvent =
  | 'rsvp_confirmed'
  | 'rsvp_declined'
  | 'potluck_signup'
  | 'potluck_update'
  | 'potluck_cancel'
  | 'profile_updated'
  | 'household_renamed'
  | 'household_member_renamed'
  | 'photo_reaction_added'
  | 'photo_reaction_removed'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'onboarding_started'
  | 'onboarding_household_created'
  | 'onboarding_household_joined'
  | 'onboarding_family_added'
  | 'onboarding_completed';

let initialized = false;

function getClient(): typeof posthog | null {
  if (typeof window === 'undefined') return null;
  if (!POSTHOG_KEY) return null;
  if (!initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      session_recording: { maskTextSelector: '.ph-no-capture' },
    });
    initialized = true;
  }
  return posthog;
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  const client = getClient();
  if (!client) return;
  client.capture(event, properties);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  const client = getClient();
  if (!client) return;
  client.identify(userId, traits);
}

export function reset(): void {
  const client = getClient();
  if (!client) return;
  client.reset();
}

export function getPostHog(): typeof posthog | null {
  return getClient();
}
