import { trpc } from '~/lib/trpc-client';

export function useRsvpMutation() {
  const utils = trpc.useUtils();

  const confirm = trpc.rsvp.confirm.useMutation({
    onSuccess: () => {
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
      void utils.rsvp.getRsvpFormState.invalidate();
    },
  });

  const decline = trpc.rsvp.decline.useMutation({
    onSuccess: () => {
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
      void utils.rsvp.getRsvpFormState.invalidate();
    },
  });

  return {
    confirm,
    decline,
  };
}

export function useRsvpFormState(eventId: string | null | undefined) {
  const { data, isLoading, error, refetch } = trpc.rsvp.getRsvpFormState.useQuery(
    { eventId: eventId ?? '' },
    { enabled: !!eventId },
  );

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
