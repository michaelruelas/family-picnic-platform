'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '~/lib/trpc-client';

/**
 * Household create form used by both the onboarding wizard
 * (`/onboarding`) and the `/household` dashboard when a logged-in
 * user has no household yet. The POST targets
 * `/api/onboarding/household`, which creates the household, links
 * the session user as a member, and seeds a self-member row so
 * the per-member RSVP form has at least one entry on first open.
 *
 * `variant="wizard"` swaps the layout to match `WizardStep` (no
 * helper text, prominent single CTA) for the onboarding flow.
 * `variant="card"` is the default for the standalone `/household`
 * page so the create surface fits the existing dashboard chrome.
 */
interface HouseholdCreateFormProps {
  /** Optional headline rendered above the input. */
  title?: string;
  /** Optional body copy rendered between the title and the input. */
  description?: string;
  /**
   * Where the form lives in the page. `card` (default) renders
   * inside the existing `/household` dashboard chrome; `wizard`
   * matches the larger typography of the onboarding step body.
   */
  variant?: 'card' | 'wizard';
  /**
   * Callback after a successful create. Default: `router.refresh()`
   * so the parent server component re-renders with the new
   * householdId. The onboarding wizard passes its own handler that
   * advances to the family step instead.
   */
  onCreated?: (householdId: string) => void;
}

export default function HouseholdCreateForm({
  title = 'Create your household',
  description = 'Households group your family together for RSVPs and planning. You can rename it any time from the household page.',
  variant = 'card',
  onCreated,
}: HouseholdCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Household name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Failed to create household');
      }
      const data = (await res.json()) as { householdId?: string };
      if (onCreated && data.householdId) {
        onCreated(data.householdId);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const isWizard = variant === 'wizard';
  const containerClass = isWizard ? 'space-y-6' : 'space-y-3';
  const inputClass = isWizard
    ? 'border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-4 py-3 text-lg shadow-sm focus:ring-1 focus:outline-none'
    : 'border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none';
  const buttonClass =
    'bg-terracotta hover:bg-terracotta rounded-sm font-medium text-white disabled:opacity-50';
  const buttonSize = isWizard ? 'w-full px-6 py-3 text-lg' : 'px-4 py-2';

  return (
    <form onSubmit={submit} className={containerClass} noValidate>
      {title && (
        <div>
          <h2
            className={
              isWizard
                ? 'text-foreground text-lg font-medium'
                : 'text-foreground text-base font-semibold'
            }
          >
            {title}
          </h2>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-sm p-3 text-sm">{error}</div>
      )}

      <div>
        <label
          htmlFor="household-create-name"
          className="text-foreground/85 block text-sm font-medium"
        >
          Household name
        </label>
        <input
          id="household-create-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Garcia Family Picnic Crew"
          disabled={submitting}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className={`${buttonClass} ${buttonSize}`}
      >
        {submitting ? 'Creating…' : 'Create household'}
      </button>
    </form>
  );
}
