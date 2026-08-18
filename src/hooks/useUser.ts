import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';

export function useUserProfileMutation() {
  const utils = trpc.useUtils();

  const updatePreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      track('profile_updated');
      void utils.user.getProfile.invalidate();
    },
  });

  return {
    updatePreferences,
  };
}
