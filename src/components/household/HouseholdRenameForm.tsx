'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '~/lib/trpc-client';

/**
 * Inline rename widget for the household name. Renders the current
 * name with an "Edit" affordance in the dashboard header; click
 * swaps to an input + Save / Cancel pair. Save calls the existing
 * `household.update` tRPC mutation, which enforces (a) the
 * case-insensitive name uniqueness and (b) that the caller is a
 * member of the household (the router checks
 * `users: { some: { id: ctx.session.user.id } }`).
 *
 * On success we `router.refresh()` so the server component
 * re-renders with the new name (and any other side-effects, e.g.
 * the cumulative RSVP card stays unchanged since name is
 * display-only).
 */
interface HouseholdRenameFormProps {
  householdId: string;
  currentName: string;
}

export default function HouseholdRenameForm({
  householdId,
  currentName,
}: HouseholdRenameFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = trpc.household.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const startEdit = () => {
    setName(currentName);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setName(currentName);
    setError(null);
    setEditing(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Household name is required');
      return;
    }
    if (trimmed === currentName) {
      setEditing(false);
      return;
    }
    updateMutation.mutate({ id: householdId, name: trimmed });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1 text-sm font-medium"
        aria-label={`Rename household ${currentName}`}
      >
        Edit name
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-sm p-2 text-sm">{error}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="household-rename-name" className="sr-only">
          Household name
        </label>
        <input
          id="household-rename-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={updateMutation.isPending}
          autoFocus
          autoComplete="off"
          aria-invalid={!!error}
          className="border-border focus:border-terracotta focus:ring-foreground/20 rounded-sm border px-3 py-1 text-base font-medium shadow-sm focus:ring-1 focus:outline-none"
        />
        <button
          type="submit"
          disabled={updateMutation.isPending || !name.trim()}
          className="bg-terracotta hover:bg-terracotta rounded-sm px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={updateMutation.isPending}
          className="text-muted-foreground hover:text-foreground rounded-sm px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
