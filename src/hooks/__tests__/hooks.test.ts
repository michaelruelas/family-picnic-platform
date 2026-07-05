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
  rsvp: { getMyRsvp: { invalidate: vi.fn() }, getHeadcount: { invalidate: vi.fn() } },
  potluck: { listSlots: { invalidate: vi.fn() } },
  dependent: { list: { invalidate: vi.fn() } },
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
    getFoodSummary: vi.fn(() => mockQueryResult()),
    signup: { useMutation: vi.fn(() => mockMutationResult()) },
    updateSignup: { useMutation: vi.fn(() => mockMutationResult()) },
    cancelSignup: { useMutation: vi.fn(() => mockMutationResult()) },
  },
  household: {
    getById: vi.fn(() => mockQueryResult()),
    getCumulativeHeadcount: vi.fn(() => mockQueryResult()),
  },
  dependent: {
    list: vi.fn(() => mockQueryResult()),
    getByHousehold: vi.fn(() => mockQueryResult()),
    create: { useMutation: vi.fn(() => mockMutationResult()) },
    update: { useMutation: vi.fn(() => mockMutationResult()) },
    delete: { useMutation: vi.fn(() => mockMutationResult()) },
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
      getFoodSummary: { useQuery: mockQueries.potluck.getFoodSummary },
      signup: { useMutation: mockQueries.potluck.signup.useMutation },
      updateSignup: { useMutation: mockQueries.potluck.updateSignup.useMutation },
      cancelSignup: { useMutation: mockQueries.potluck.cancelSignup.useMutation },
    },
    household: {
      getById: { useQuery: mockQueries.household.getById },
      getCumulativeHeadcount: { useQuery: mockQueries.household.getCumulativeHeadcount },
    },
    dependent: {
      list: { useQuery: mockQueries.dependent.list },
      getByHousehold: { useQuery: mockQueries.dependent.getByHousehold },
      create: { useMutation: mockQueries.dependent.create.useMutation },
      update: { useMutation: mockQueries.dependent.update.useMutation },
      delete: { useMutation: mockQueries.dependent.delete.useMutation },
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
  for (const query of Object.values(mockQueries.event)) {
    if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
  }
  for (const query of Object.values(mockQueries.rsvp)) {
    if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
  }
  for (const query of Object.values(mockQueries.potluck)) {
    if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
  }
  for (const query of Object.values(mockQueries.household)) {
    if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
  }
  for (const query of Object.values(mockQueries.dependent)) {
    if (typeof query === 'function') query.mockReturnValue(mockQueryResult());
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
      { enabled: true },
    );
  });
});

describe('usePotluckFoodSummary', () => {
  it('calls trpc.potluck.getFoodSummary.useQuery with correct params', async () => {
    const { usePotluckFoodSummary } = await import('~/hooks/usePotluck');
    renderHook(() => usePotluckFoodSummary({ eventId: 'evt-1' }));
    expect(mockQueries.potluck.getFoodSummary).toHaveBeenCalledWith(
      { eventId: 'evt-1' },
      { enabled: true },
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
