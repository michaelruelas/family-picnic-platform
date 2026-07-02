import { trpc } from '~/lib/trpc-client';

export function useUserProfileMutation() {
  const utils = trpc.useUtils();

  const updatePreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      void utils.user.getProfile.invalidate();
    },
  });

  return {
    updatePreferences,
  };
}
