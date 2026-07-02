import { trpc } from '~/lib/trpc-client';

interface UseHouseholdReturn {
  household: ReturnType<typeof trpc.household.getById.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseHouseholdOptions {
  householdId: string;
}

export function useHousehold({ householdId }: UseHouseholdOptions): UseHouseholdReturn {
  const { data, isLoading, error, refetch } = trpc.household.getById.useQuery(
    { id: householdId },
    { enabled: !!householdId },
  );

  return {
    household: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

interface UseHouseholdCumulativeHeadcountReturn {
  data: {
    totalHeadcount: number;
    byEvent: Array<{
      eventId: string;
      eventName: string;
      eventDate: Date;
      headcount: number;
    }>;
  };
  isLoading: boolean;
  error: Error | null;
}

interface UseHouseholdCumulativeHeadcountOptions {
  householdId: string;
}

export function useHouseholdCumulativeHeadcount({
  householdId,
}: UseHouseholdCumulativeHeadcountOptions): UseHouseholdCumulativeHeadcountReturn {
  const { data, isLoading, error } = trpc.household.getCumulativeHeadcount.useQuery(
    { householdId },
    { enabled: !!householdId },
  );

  return {
    data: data ?? { totalHeadcount: 0, byEvent: [] },
    isLoading,
    error: error as Error | null,
  };
}

interface UseDependentsReturn {
  dependents: ReturnType<typeof trpc.dependent.list.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDependents(): UseDependentsReturn {
  const { data, isLoading, error, refetch } = trpc.dependent.list.useQuery();

  return {
    dependents: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

interface UseHouseholdDependentsReturn {
  dependents: ReturnType<typeof trpc.dependent.getByHousehold.useQuery>['data'];
  isLoading: boolean;
  error: Error | null;
}

interface UseHouseholdDependentsOptions {
  householdId: string;
}

export function useHouseholdDependents({
  householdId,
}: UseHouseholdDependentsOptions): UseHouseholdDependentsReturn {
  const { data, isLoading, error } = trpc.dependent.getByHousehold.useQuery(
    { householdId },
    { enabled: !!householdId },
  );

  return {
    dependents: data,
    isLoading,
    error: error as Error | null,
  };
}

export function useDependentMutations() {
  const utils = trpc.useUtils();

  const create = trpc.dependent.create.useMutation({
    onSuccess: () => {
      void utils.dependent.list.invalidate();
      void utils.household.getById.invalidate();
    },
  });

  const update = trpc.dependent.update.useMutation({
    onSuccess: () => {
      void utils.dependent.list.invalidate();
      void utils.household.getById.invalidate();
    },
  });

  const remove = trpc.dependent.delete.useMutation({
    onSuccess: () => {
      void utils.dependent.list.invalidate();
      void utils.household.getById.invalidate();
    },
  });

  return {
    create,
    update,
    remove,
  };
}
