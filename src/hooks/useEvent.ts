import { trpc } from '~/lib/trpc-client';

interface UseEventReturn {
  event: ReturnType<typeof trpc.event.getById.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
}

interface UseEventOptions {
  eventId: string;
}

export function useEvent({ eventId }: UseEventOptions): UseEventReturn {
  const { data, isLoading, error } = trpc.event.getById.useQuery(
    { id: eventId },
    { enabled: !!eventId },
  );

  return {
    event: data,
    isLoading,
    error: error as Error | null,
  };
}

interface UseEventRsvpReturn {
  rsvp: ReturnType<typeof trpc.rsvp.getMyRsvp.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseEventRsvpOptions {
  eventId: string;
}

export function useEventRsvp({ eventId }: UseEventRsvpOptions): UseEventRsvpReturn {
  const { data, isLoading, error, refetch } = trpc.rsvp.getMyRsvp.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  return {
    rsvp: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

interface UseEventHeadcountReturn {
  headcount: {
    totalHeadcount: number;
    totalRsvps: number;
  };
  isLoading: boolean;
  error: Error | null;
}

interface UseEventHeadcountOptions {
  eventId: string;
}

export function useEventHeadcount({ eventId }: UseEventHeadcountOptions): UseEventHeadcountReturn {
  const { data, isLoading, error } = trpc.rsvp.getHeadcount.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  return {
    headcount: data ?? { totalHeadcount: 0, totalRsvps: 0 },
    isLoading,
    error: error as Error | null,
  };
}
