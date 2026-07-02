import { trpc } from '~/lib/trpc-client';

export function useRsvpMutation() {
  const utils = trpc.useUtils();

  const confirm = trpc.rsvp.confirm.useMutation({
    onSuccess: () => {
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
    },
  });

  const decline = trpc.rsvp.decline.useMutation({
    onSuccess: () => {
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
    },
  });

  return {
    confirm,
    decline,
  };
}
