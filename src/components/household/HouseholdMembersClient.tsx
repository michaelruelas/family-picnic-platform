'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '~/lib/trpc-client';

interface Member {
  id: string;
  name: string;
  // FPP-122: age is required at the DB and schema layer. The UI
  // always collects it on add/edit; existing rows read it back as
  // a non-null number.
  age: number;
  notes: string | null;
}

interface HouseholdMembersClientProps {
  householdId: string;
  initialMembers: Member[];
}

const BACKFILL_PREFIX = 'Backfilled from';

function isBackfilled(member: Member): boolean {
  return !!member.notes && member.notes.startsWith(BACKFILL_PREFIX);
}

function backfillLabel(member: Member): string {
  if (!member.notes) return 'Imported';
  return member.notes.includes('dependent') ? 'Imported from dependents' : 'Imported from account';
}

export default function HouseholdMembersClient({
  householdId,
  initialMembers,
}: HouseholdMembersClientProps) {
  const router = useRouter();
  // FPP-117/FPP-121: a roster edit (create / update / delete) must
  // invalidate the tRPC caches that the RSVP modal reads so the
  // next open reflects the new member without a hard reload.
  const utils = trpc.useUtils();
  const invalidateRsvpForm = () => {
    void utils.rsvp.getRsvpFormState.invalidate();
    void utils.user.getProfile.invalidate();
    void utils.household.getById.invalidate();
  };
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // FPP-122: the form always carries an age value. Empty string
  // means "no value yet"; the submit handler refuses to send it.
  const [form, setForm] = useState({ name: '', age: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setForm({ name: '', age: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const startEdit = (member: Member) => {
    setForm({
      name: member.name,
      // FPP-122: members always have an age now; fall back to '' only
      // for legacy rows the migration hasn't touched yet.
      age: member.age !== null && member.age !== undefined ? String(member.age) : '',
      notes: isBackfilled(member) ? '' : (member.notes ?? ''),
    });
    setEditingId(member.id);
    setShowForm(true);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // FPP-122: age is required. The schema also rejects negative or
    // over-120 values; we surface the same error before the request
    // so the user does not wait on a round-trip just to see the
    // server complain.
    const trimmedAge = form.age.trim();
    if (trimmedAge === '') {
      setError('Age is required');
      setSubmitting(false);
      return;
    }
    const ageValue = Number(trimmedAge);
    if (
      !Number.isFinite(ageValue) ||
      !Number.isInteger(ageValue) ||
      ageValue < 0 ||
      ageValue > 120
    ) {
      setError('Age must be a whole number between 0 and 120.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(
        editingId ? `/api/household-members/${editingId}` : '/api/household-members',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId,
            name: form.name,
            age: ageValue,
            notes: form.notes.trim() === '' ? null : form.notes.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save member');
        return;
      }

      if (editingId) {
        setMembers(members.map((m) => (m.id === editingId ? data : m)));
      } else {
        setMembers([...members, data]);
      }
      reset();
      router.refresh();
      // FPP-117/FPP-121: push the new member into the RSVP form
      // cache so a subsequent open shows the updated roster.
      invalidateRsvpForm();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this household member?')) return;

    try {
      const response = await fetch(`/api/household-members/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.error || 'Failed to remove member');
        return;
      }

      setMembers(members.filter((m) => m.id !== id));
      router.refresh();
      // FPP-121: drop the removed member from the RSVP form
      // snapshot so the next open does not show them again.
      invalidateRsvpForm();
    } catch {
      alert('Something went wrong. Please try again.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Household Members</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Name and age of everyone in your household
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1 text-sm font-medium"
          >
            + Add Member
          </button>
        )}
      </div>

      {members.length === 0 && !showForm ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No members added yet. Add at least one member to save your household.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {members.map((member) => {
            const backfilled = isBackfilled(member);
            return (
              <li
                key={member.id}
                className="border-border flex items-center justify-between rounded-sm border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-terracotta/15 text-terracotta flex h-10 w-10 items-center justify-center rounded-sm font-medium">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{member.name}</span>
                      {backfilled && (
                        <span
                          className="bg-warning/20 text-warning-foreground rounded-sm px-2 py-0.5 text-xs font-medium"
                          title="Edit to confirm the imported name and age"
                        >
                          {backfillLabel(member)}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {member.age !== null && member.age !== undefined
                        ? `${member.age} yrs`
                        : 'Age not set'}
                      {!backfilled && member.notes && (
                        <span className="ml-2 italic">— {member.notes}</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => startEdit(member)}
                    className="text-primary hover:text-primary-hover font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(member.id)}
                    className="text-destructive hover:text-foreground"
                    disabled={members.length <= 1}
                    title={
                      members.length <= 1 ? 'At least one member is required' : 'Remove member'
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="border-border bg-secondary/60 mt-6 rounded-sm border p-4"
        >
          <h3 className="text-foreground text-lg font-medium">
            {editingId ? 'Edit Member' : 'Add Member'}
          </h3>

          {error && (
            <div className="bg-destructive/10 text-destructive mt-3 rounded-sm p-3 text-sm">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="member-name" className="text-foreground/85 block text-sm font-medium">
                Name
              </label>
              <input
                id="member-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Full name"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="member-age" className="text-foreground/85 block text-sm font-medium">
                Age <span className="text-destructive">*</span>
              </label>
              <input
                id="member-age"
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                required
                placeholder="Age in years"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="member-notes" className="text-foreground/85 block text-sm font-medium">
              Notes (optional)
            </label>
            <textarea
              id="member-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              maxLength={500}
              placeholder="Allergies, preferences, anything to remember"
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-terracotta hover:bg-terracotta flex-1 rounded-sm px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Member'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={submitting}
              className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-sm px-4 py-2 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
