import { track, identify, type AnalyticsEvent } from '~/lib/analytics';

export function useAnalytics() {
  return {
    track: (event: AnalyticsEvent, properties?: Record<string, unknown>) => {
      track(event, { ...properties, timestamp: Date.now() });
    },
    identify: (userId: string, traits?: Record<string, unknown>) => {
      identify(userId, traits);
    },
  };
}

export type { AnalyticsEvent };
