import { trpc } from '~/lib/trpc-client';

export function usePhotoReactionMutation() {
  const utils = trpc.useUtils();

  const addReaction = trpc.photo.addReaction.useMutation({
    onSuccess: () => {
      void utils.photo.list.invalidate();
    },
  });

  const removeReaction = trpc.photo.removeReaction.useMutation({
    onSuccess: () => {
      void utils.photo.list.invalidate();
    },
  });

  return {
    addReaction,
    removeReaction,
  };
}
