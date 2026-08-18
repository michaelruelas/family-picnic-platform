import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

function mockQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function mockMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const mockUseUtils = vi.fn(() => ({
  rsvp: {
    getMyRsvp: { invalidate: vi.fn() },
    getHeadcount: { invalidate: vi.fn() },
    getRsvpFormState: { invalidate: vi.fn() },
  },
  potluck: {
    listSlots: { invalidate: vi.fn() },
    getSlotsForEvent: { invalidate: vi.fn() },
    getMySignups: { invalidate: vi.fn() },
    getFoodSummary: { invalidate: vi.fn() },
  },
  household: { getById: { invalidate: vi.fn() } },
  photo: { list: { invalidate: vi.fn() } },
  user: { getProfile: { invalidate: vi.fn() } },
}));

const mockQueries = {
  event: {
    getById: vi.fn(() => mockQueryResult()),
  },
  rsvp: {
    getMyRsvp: vi.fn(() => mockQueryResult()),
    getHeadcount: vi.fn(() => mockQueryResult()),
    confirm: { useMutation: vi.fn(() => mockMutationResult()) },
    decline: { useMutation: vi.fn(() => mockMutationResult()) },
  },
  potluck: {
    listSlots: vi.fn(() => mockQueryResult()),
    getMySignups: vi.fn(() => mockQueryResult()),
    getFoodSummary: vi.fn(() => mockQueryResult()),
    signup: { useMutation: vi.fn(() => mockMutationResult()) },
    updateSignup: { useMutation: vi.fn(() => mockMutationResult()) },
    cancelSignup: { useMutation: vi.fn(() => mockMutationResult()) },
  },
  household: {
    getById: vi.fn(() => mockQueryResult()),
    getCumulativeHeadcount: vi.fn(() => mockQueryResult()),
  },
  photo: {
    addReaction: { useMutation: vi.fn(() => mockMutationResult()) },
    removeReaction: { useMutation: vi.fn(() => mockMutationResult()) },
  },
  user: {
    updatePreferences: { useMutation: vi.fn(() => mockMutationResult()) },
  },
};

vi.mock('~/lib/trpc-client', () => ({
  trpc: {
    event: {
      getById: { useQuery: mockQueries.event.getById },
    },
    rsvp: {
      getMyRsvp: { useQuery: mockQueries.rsvp.getMyRsvp },
      getHeadcount: { useQuery: mockQueries.rsvp.getHeadcount },
      confirm: { useMutation: mockQueries.rsvp.confirm.useMutation },
      decline: { useMutation: mockQueries.rsvp.decline.useMutation },
    },
    potluck: {
      listSlots: { useQuery: mockQueries.potluck.listSlots },
      getMySignups: { useQuery: mockQueries.potluck.getMySignups },
      getFoodSummary: { useQuery: mockQueries.potluck.getFoodSummary },
      signup: { useMutation: mockQueries.potluck.signup.useMutation },
      updateSignup: { useMutation: mockQueries.potluck.updateSignup.useMutation },
      cancelSignup: { useMutation: mockQueries.potluck.cancelSignup.useMutation },
    },
    household: {
      getById: { useQuery: mockQueries.household.getById },
      getCumulativeHeadcount: { useQuery: mockQueries.household.getCumulativeHeadcount },
    },
    photo: {
      addReaction: { useMutation: mockQueries.photo.addReaction.useMutation },
      removeReaction: { useMutation: mockQueries.photo.removeReaction.useMutation },
    },
    user: {
      updatePreferences: { useMutation: mockQueries.user.updatePreferences.useMutation },
    },
    useUtils: mockUseUtils,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const namespace of Object.values(mockQueries)) {
    for (const query of Object.values(namespace)) {
      if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
    }
  }
});

describe('useEvent', () => {
  it('calls trpc.event.getById.useQuery with correct params', async () => {
    const { useEvent } = await import('~/hooks/useEvent');
    renderHook(() => useEvent({ eventId: 'evt-1' }));
    expect(mockQueries.event.getById).toHaveBeenCalledWith({ id: 'evt-1' }, { enabled: true });
  });

  it('returns event data from query', async () => {
    const mockEvent = { id: 'evt-1', name: 'Picnic' };
    mockQueries.event.getById.mockReturnValue(
      mockQueryResult({ data: mockEvent, isLoading: false, error: null }),
    );
    const { useEvent } = await import('~/hooks/useEvent');
    const { result } = renderHook(() => useEvent({ eventId: 'evt-1' }));
    expect(result.current.event).toEqual(mockEvent);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useEventRsvp', () => {
  it('calls trpc.rsvp.getMyRsvp.useQuery with correct params', async () => {
    const { useEventRsvp } = await import('~/hooks/useEvent');
    renderHook(() => useEventRsvp({ eventId: 'evt-1' }));
    expect(mockQueries.rsvp.getMyRsvp).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true },
    );
  });
});

describe('useEventHeadcount', () => {
  it('calls trpc.rsvp.getHeadcount.useQuery with correct params', async () => {
    const { useEventHeadcount } = await import('~/hooks/useEvent');
    renderHook(() => useEventHeadcount({ eventId: 'evt-1' }));
    expect(mockQueries.rsvp.getHeadcount).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true },
    );
  });

  it('provides default headcount when data is null', async () => {
    mockQueries.rsvp.getHeadcount.mockReturnValue(
      mockQueryResult({ data: null, isLoading: false, error: null }),
    );
    const { useEventHeadcount } = await import('~/hooks/useEvent');
    const { result } = renderHook(() => useEventHeadcount({ eventId: 'evt-1' }));
    expect(result.current.headcount).toEqual({ totalHeadcount: 0, totalRsvps: 0 });
  });
});

describe('usePotluckSlots', () => {
  it('calls trpc.potluck.listSlots.useQuery with correct params', async () => {
    const { usePotluckSlots } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckSlots({ eventId: 'evt-1' }));
    expect(mockQueries.potluck.listSlots).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true, staleTime: 0 },
    );
  });
});

describe('useMyPotluckSignups', () => {
  it('calls trpc.potluck.getMySignups.useQuery with correct params', async () => {
    const { useMyPotluckSignups } = await import('~/hooks/usePotluck');
    renderHook(() => useMyPotluckSignups({ eventId: 'evt-1' }));
    expect(mockQueries.potluck.getMySignups).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true, staleTime: 0 },
    );
  });

  it('disables the query when enabled is false', async () => {
    const { useMyPotluckSignups } = await import('~/hooks/usePotluck');
    renderHook(() => useMyPotluckSignups({ eventId: 'evt-1', enabled: false }));
    expect(mockQueries.potluck.getMySignups).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: false, staleTime: 0 },
    );
  });

  it('returns an empty signup list when data is null', async () => {
    mockQueries.potluck.getMySignups.mockReturnValue(
      mockQueryResult({ data: null, isLoading: false, error: null }),
    );
    const { useMyPotluckSignups } = await import('~/hooks/usePotluck');
    const { result } = renderHook(() => useMyPotluckSignups({ eventId: 'evt-1' }));
    expect(result.current.signups).toEqual([]);
  });

  it('passes through the call data and loading state', async () => {
    const data = [
      {
        id: 'ps-1',
        slotId: 's-1',
        dishName: 'Brownies',
        servings: 1,
        dietaryLabels: [],
        claimedAt: new Date(),
        slot: { id: 's-1', name: 'Dessert 1', category: 'DESSERT', slotType: 'UNLIMITED' },
      },
    ];
    mockQueries.potluck.getMySignups.mockReturnValue(
      mockQueryResult({ data, isLoading: false, error: null }),
    );
    const { useMyPotluckSignups } = await import('~/hooks/usePotluck');
    const { result } = renderHook(() => useMyPotluckSignups({ eventId: 'evt-1' }));
    expect(result.current.signups).toEqual(data);
  });
});

describe('usePotluckFoodSummary', () => {
  it('calls trpc.potluck.getFoodSummary.useQuery with correct params', async () => {
    const { usePotluckFoodSummary } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckFoodSummary({ eventId: 'evt-1' }));
    expect(mockQueries.potluck.getFoodSummary).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true, staleTime: 0 },
    );
  });
});

describe('usePotluckSignupMutation', () => {
  it('returns signup, updateSignup, cancelSignup', async () => {
    const { usePotluckSignupMutation } = await import('~/hooks/usePotluck');
    const { result } = renderHook(() => usePotluckSignupMutation());
    expect(result.current).toHaveProperty('signup');
    expect(result.current).toHaveProperty('updateSignup');
    expect(result.current).toHaveProperty('cancelSignup');
  });

  it('calls trpc.useUtils', async () => {
    const { usePotluckSignupMutation } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckSignupMutation());
    expect(mockUseUtils).toHaveBeenCalled();
  });

  it('sets up onSuccess with listSlots invalidation for signup', async () => {
    const { usePotluckSignupMutation } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckSignupMutation());
    expect(mockQueries.potluck.signup.useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });

  it('awaits every potluck query invalidation after signup', async () => {
    mockQueries.potluck.signup.useMutation.mockClear();
    const { usePotluckSignupMutation } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckSignupMutation());
    const opts = (
      mockQueries.potluck.signup.useMutation.mock.calls[0] as unknown as
        | Array<{
            onSuccess: (
              data: unknown,
              variables: {
                slotId: string;
                dishName: string;
                servings: number;
                dietaryLabels: string[];
              },
            ) => Promise<void>;
          }>
        | undefined
    )?.[0];
    const lastUtils = mockUseUtils.mock.results.at(-1)?.value;
    expect(opts).toBeDefined();
    expect(lastUtils).toBeDefined();
    await opts!.onSuccess(
      {},
      { slotId: 'slot-1', dishName: 'Mac and Cheese', servings: 4, dietaryLabels: [] },
    );
    expect(lastUtils!.potluck.listSlots.invalidate).toHaveBeenCalled();
    expect(lastUtils!.potluck.getSlotsForEvent.invalidate).toHaveBeenCalled();
    expect(lastUtils!.potluck.getMySignups.invalidate).toHaveBeenCalled();
    expect(lastUtils!.potluck.getFoodSummary.invalidate).toHaveBeenCalled();
  });

  it('sets up onSuccess with getMySignups invalidation for cancelSignup', async () => {
    mockQueries.potluck.cancelSignup.useMutation.mockClear();
    const { usePotluckSignupMutation } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckSignupMutation());
    const opts = (
      mockQueries.potluck.cancelSignup.useMutation.mock.calls[0] as unknown as
        | Array<{ onSuccess: (data: unknown, variables: { signupId: string }) => Promise<void> }>
        | undefined
    )?.[0];
    expect(opts).toBeDefined();
    const lastUtils = mockUseUtils.mock.results.at(-1)?.value;
    expect(lastUtils).toBeDefined();
    await opts!.onSuccess({}, { signupId: 'signup-1' });
    expect(lastUtils!.potluck.getMySignups.invalidate).toHaveBeenCalled();
  });
});

describe('useRsvpMutation', () => {
  it('returns confirm and decline', async () => {
    const { useRsvpMutation } = await import('~/hooks/useRsvp');
    const { result } = renderHook(() => useRsvpMutation());
    expect(result.current).toHaveProperty('confirm');
    expect(result.current).toHaveProperty('decline');
  });

  it('sets up onSuccess with invalidate calls for confirm', async () => {
    const { useRsvpMutation } = await import('~/hooks/useRsvp');
    renderHook(() => useRsvpMutation());
    expect(mockQueries.rsvp.confirm.useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });

  it('sets up onSuccess for decline', async () => {
    const { useRsvpMutation } = await import('~/hooks/useRsvp');
    renderHook(() => useRsvpMutation());
    expect(mockQueries.rsvp.decline.useMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });
});

describe('useHousehold', () => {
  it('calls trpc.household.getById.useQuery with correct params', async () => {
    const { useHousehold } = await import('~/hooks/useHousehold');
    renderHook(() => useHousehold({ householdId: 'hh-1' }));
    expect(mockQueries.household.getById).toHaveBeenCalledWith({ id: 'hh-1' }, { enabled: true });
  });

  it('returns household data with isLoading and error', async () => {
    mockQueries.household.getById.mockReturnValue(
      mockQueryResult({ data: { id: 'hh-1' }, isLoading: false, error: null }),
    );
    const { useHousehold } = await import('~/hooks/useHousehold');
    const { result } = renderHook(() => useHousehold({ householdId: 'hh-1' }));
    expect(result.current.household).toEqual({ id: 'hh-1' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes refetch from the underlying query', async () => {
    const refetch = vi.fn();
    mockQueries.household.getById.mockReturnValue(mockQueryResult({ refetch }));
    const { useHousehold } = await import('~/hooks/useHousehold');
    const { result } = renderHook(() => useHousehold({ householdId: 'hh-1' }));
    expect(result.current.refetch).toBe(refetch);
  });

  it('coerces error to Error | null', async () => {
    const err = new Error('boom');
    mockQueries.household.getById.mockReturnValue(mockQueryResult({ error: err }));
    const { useHousehold } = await import('~/hooks/useHousehold');
    const { result } = renderHook(() => useHousehold({ householdId: 'hh-1' }));
    expect(result.current.error).toBe(err);
  });

  it('disables query when householdId is empty', async () => {
    const { useHousehold } = await import('~/hooks/useHousehold');
    renderHook(() => useHousehold({ householdId: '' }));
    expect(mockQueries.household.getById).toHaveBeenCalledWith({ id: '' }, { enabled: false });
  });
});

describe('useHouseholdCumulativeHeadcount', () => {
  it('calls trpc.household.getCumulativeHeadcount.useQuery', async () => {
    const { useHouseholdCumulativeHeadcount } = await import('~/hooks/useHousehold');
    renderHook(() => useHouseholdCumulativeHeadcount({ householdId: 'hh-1' }));
    expect(mockQueries.household.getCumulativeHeadcount).toHaveBeenCalledWith(
      { householdId: 'hh-1' },
      { enabled: true },
    );
  });

  it('falls back to zeroed default when data is null', async () => {
    mockQueries.household.getCumulativeHeadcount.mockReturnValue(
      mockQueryResult({ data: null, isLoading: false, error: null }),
    );
    const { useHouseholdCumulativeHeadcount } = await import('~/hooks/useHousehold');
    const { result } = renderHook(() => useHouseholdCumulativeHeadcount({ householdId: 'hh-1' }));
    expect(result.current.data).toEqual({ totalHeadcount: 0, byEvent: [] });
  });

  it('passes through data, isLoading, and error', async () => {
    const data = {
      totalHeadcount: 5,
      byEvent: [
        { eventId: 'e1', eventName: 'Picnic', eventDate: new Date('2025-01-01'), headcount: 5 },
      ],
    };
    mockQueries.household.getCumulativeHeadcount.mockReturnValue(
      mockQueryResult({ data, isLoading: true, error: null }),
    );
    const { useHouseholdCumulativeHeadcount } = await import('~/hooks/useHousehold');
    const { result } = renderHook(() => useHouseholdCumulativeHeadcount({ householdId: 'hh-1' }));
    expect(result.current.data).toEqual(data);
    expect(result.current.isLoading).toBe(true);
  });

  it('disables query when householdId is empty', async () => {
    const { useHouseholdCumulativeHeadcount } = await import('~/hooks/useHousehold');
    renderHook(() => useHouseholdCumulativeHeadcount({ householdId: '' }));
    expect(mockQueries.household.getCumulativeHeadcount).toHaveBeenCalledWith(
      { householdId: '' },
      { enabled: false },
    );
  });
});

describe('useMounted', () => {
  it('returns true when called on client', async () => {
    const { useMounted } = await import('~/hooks/useMounted');
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
  });
});

describe('useOffline', () => {
  it('returns isOnline and lastOnline', async () => {
    const { useOffline } = await import('~/hooks/useOffline');
    const { result } = renderHook(() => useOffline());
    expect(result.current).toHaveProperty('isOnline');
    expect(result.current).toHaveProperty('lastOnline');
  });
});

describe('usePhotoReactionMutation', () => {
  it('returns addReaction and removeReaction', async () => {
    const { usePhotoReactionMutation } = await import('~/hooks/usePhoto');
    const { result } = renderHook(() => usePhotoReactionMutation());
    expect(result.current).toHaveProperty('addReaction');
    expect(result.current).toHaveProperty('removeReaction');
  });

  it('calls trpc.useUtils', async () => {
    const { usePhotoReactionMutation } = await import('~/hooks/usePhoto');
    renderHook(() => usePhotoReactionMutation());
    expect(mockUseUtils).toHaveBeenCalled();
  });
});

describe('useUserProfileMutation', () => {
  it('returns updatePreferences', async () => {
    const { useUserProfileMutation } = await import('~/hooks/useUser');
    const { result } = renderHook(() => useUserProfileMutation());
    expect(result.current).toHaveProperty('updatePreferences');
  });

  it('calls trpc.useUtils', async () => {
    const { useUserProfileMutation } = await import('~/hooks/useUser');
    renderHook(() => useUserProfileMutation());
    expect(mockUseUtils).toHaveBeenCalled();
  });
});
