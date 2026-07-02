'use client';

import { useState } from 'react';
import { useOffline, useRsvpMutation } from '~/hooks';

interface RSVPFormProps {
  eventId: string;
  existingRsvp?: {
    status: string;
    headcount: number;
    dietaryNotes: string | null;
  } | null;
  rsvpDeadline?: string | null;
  isPast: boolean;
  maxCapacity?: number | null;
  currentAttending: number;
}

export default function RSVPForm({
  eventId,
  existingRsvp,
  rsvpDeadline,
  isPast,
  maxCapacity,
  currentAttending,
}: RSVPFormProps) {
  const { isOnline } = useOffline();
  const { confirm, decline } = useRsvpMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [headcount, setHeadcount] = useState(existingRsvp?.headcount || 1);
  const [dietaryNotes, setDietaryNotes] = useState(existingRsvp?.dietaryNotes || '');
  const [error, setError] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const isRsvpOpen = !isPast && (!rsvpDeadline || new Date(rsvpDeadline) > new Date());
  const spotsRemaining = maxCapacity ? maxCapacity - currentAttending : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;

  const handleSubmit = async (action: 'confirm' | 'decline') => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (action === 'confirm') {
        await confirm.mutateAsync({
          eventId,
          headcount,
          dietaryNotes: dietaryNotes || undefined,
        });
      } else {
        await decline.mutateAsync({ eventId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  };

  if (isPast) {
    return (
      <div className="rounded-lg bg-stone-100 p-4 text-stone-600">
        <p className="font-medium">This event has already taken place.</p>
        {existingRsvp && existingRsvp.status === 'CONFIRMED' && (
          <p className="mt-1 text-sm">You attended this event.</p>
        )}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
        <p className="font-medium">You are currently offline.</p>
        <p className="mt-1 text-sm">RSVPs require an internet connection. Please try again when you are back online.</p>
      </div>
    );
  }

  if (existingRsvp) {
    const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
      CONFIRMED: { label: "You're Attending!", color: 'text-green-700', bg: 'bg-green-50' },
      DECLINED: { label: 'You Declined', color: 'text-red-700', bg: 'bg-red-50' },
      PENDING: { label: 'Response Pending', color: 'text-amber-700', bg: 'bg-amber-50' },
      INVITED: { label: 'Invitation Pending', color: 'text-stone-700', bg: 'bg-stone-50' },
    };

    const defaultStatus = { label: 'Unknown', color: 'text-stone-700', bg: 'bg-stone-50' };
    const status = statusLabels[existingRsvp.status] ?? defaultStatus;

    if (isEditing && existingRsvp.status === 'CONFIRMED') {
      return (
        <div className="rounded-lg bg-green-50 p-4">
          <h3 className="text-lg font-medium text-green-900">Edit Your RSVP</h3>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">Number of People</label>
              <select
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(
                  (n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'person' : 'people'}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700">
                Dietary Notes (optional)
              </label>
              <textarea
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Allergies, preferences, etc."
                rows={2}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit('confirm')}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : '✓ Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setHeadcount(existingRsvp.headcount);
                  setDietaryNotes(existingRsvp.dietaryNotes || '');
                  setError(null);
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-lg ${status.bg} p-4`}>
        <p className={`font-medium ${status.color}`}>{status.label}</p>
        {existingRsvp.status === 'CONFIRMED' && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-stone-600">
              Headcount: {existingRsvp.headcount}
              {existingRsvp.headcount > 1 && ' (including guests)'}
            </p>
            {existingRsvp.dietaryNotes && (
              <p className="text-sm text-stone-600">Dietary notes: {existingRsvp.dietaryNotes}</p>
            )}
            {isRsvpOpen && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeclineConfirm(true)}
                  disabled={isSubmitting}
                  className="rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        )}
        {existingRsvp.status === 'DECLINED' && isRsvpOpen && (
          <button
            onClick={() => handleSubmit('confirm')}
            disabled={isSubmitting || isFull}
            className="mt-2 rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : isFull ? 'Event is Full' : 'Change to Attending'}
          </button>
        )}

        {showDeclineConfirm && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">Are you sure you want to decline this event?</p>
            <p className="mt-1 text-sm text-red-600">
              You can change your response later if you change your mind.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setShowDeclineConfirm(false);
                  handleSubmit('decline');
                }}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Yes, Decline'}
              </button>
              <button
                onClick={() => setShowDeclineConfirm(false)}
                disabled={isSubmitting}
                className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isRsvpOpen) {
    return (
      <div className="rounded-lg bg-stone-100 p-4 text-stone-600">
        <p className="font-medium">RSVP is closed for this event.</p>
        {rsvpDeadline && (
          <p className="mt-1 text-sm">
            The RSVP deadline was {new Date(rsvpDeadline).toLocaleDateString()}.
          </p>
        )}
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="rounded-lg bg-stone-100 p-4 text-stone-600">
        <p className="font-medium">This event is full.</p>
        <p className="mt-1 text-sm">All spots have been taken.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h3 className="text-lg font-medium text-stone-900">RSVP for this Event</h3>
      {spotsRemaining !== null && (
        <p className="mt-1 text-sm text-stone-500">
          {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} remaining
        </p>
      )}

      {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700">Number of People</label>
          <select
            value={headcount}
            onChange={(e) => setHeadcount(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'person' : 'people'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700">
            Dietary Notes (optional)
          </label>
          <textarea
            value={dietaryNotes}
            onChange={(e) => setDietaryNotes(e.target.value)}
            placeholder="Allergies, preferences, etc."
            rows={2}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit('confirm')}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : '✓ Confirm Attendance'}
          </button>
          <button
            onClick={() => setShowDeclineConfirm(true)}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
          >
            ✗ Decline
          </button>
        </div>

        {showDeclineConfirm && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">Are you sure you want to decline this event?</p>
            <p className="mt-1 text-sm text-red-600">
              You can change your response later if you change your mind.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setShowDeclineConfirm(false);
                  handleSubmit('decline');
                }}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Decline'}
              </button>
              <button
                onClick={() => setShowDeclineConfirm(false)}
                disabled={isSubmitting}
                className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
