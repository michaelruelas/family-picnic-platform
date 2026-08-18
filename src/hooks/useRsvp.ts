import { useRouter } from 'next/navigation';
import { trpc } from '~/lib/trpc-client';
import { track } from '~/lib/analytics';

export function useRsvpMutation() {
  const utils = trpc.useUtils();
  const router = useRouter();

  const confirm = trpc.rsvp.confirm.useMutation({
    onSuccess: (_data, variables) => {
      track('rsvp_confirmed', { eventId: variables.eventId });
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
      void utils.rsvp.getRsvpFormState.invalidate();
      // The event page is a server component that reads the caller's
      // RSVP directly via Prisma. Invalidating the tRPC cache above
      // only refreshes client-side queries; the server-rendered RSVP
      // card and sticky bar still show the pre-RSVP state until the
      // route is re-fetched. router.refresh() re-renders the server
      // tree with the new RSVP row so the card flips from "RSVP Now"
      // to "You're in!" without a manual reload.
      router.refresh();
    },
  });

  const decline = trpc.rsvp.decline.useMutation({
    onSuccess: (_data, variables) => {
      track('rsvp_declined', { eventId: variables.eventId });
      void utils.rsvp.getMyRsvp.invalidate();
      void utils.rsvp.getHeadcount.invalidate();
      void utils.rsvp.getRsvpFormState.invalidate();
      // Mirror the confirm path: re-render the server tree so the
      // RSVP card flips to the "You declined" state immediately.
      router.refresh();
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
