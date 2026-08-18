import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';

export function useUserProfileMutation() {
  const utils = trpc.useUtils();

  const updatePreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      track('profile_updated');
      void utils.user.getProfile.invalidate();
      // FPP-34: the RSVP sheet hydrates its phone + SMS-consent
      // checkbox from the getRsvpFormState snapshot. If we do not
      // invalidate it here, the cache keeps the pre-update value
      // (e.g. smsConsent: false) and the next sheet open reseeds an
      // unchecked consent box even though the DB now has the user
      // opted in. Forcing a refetch keeps the snapshot in lockstep
      // with the profile write.
      void utils.rsvp.getRsvpFormState.invalidate();
    },
  });

  return {
    updatePreferences,
  };
}
