import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';

export function usePhotoReactionMutation() {
  const utils = trpc.useUtils();

  const addReaction = trpc.photo.addReaction.useMutation({
    onSuccess: (_data, variables) => {
      track('photo_reaction_added', { photoId: variables.photoId });
      void utils.photo.list.invalidate();
    },
  });

  const removeReaction = trpc.photo.removeReaction.useMutation({
    onSuccess: (_data, variables) => {
      track('photo_reaction_removed', { photoId: variables.photoId });
      void utils.photo.list.invalidate();
    },
  });

  return {
    addReaction,
    removeReaction,
  };
}
