'use client';

import { useState } from 'react';
import {
  parseDietaryNotesToLabels,
  getDietarySummary,
  STANDARD_DIETARY_LABELS,
  type DietaryAttendee,
} from '~/lib/dietary';
import DietaryFilter from './DietaryFilter';
import DietaryLabelChip, { getDietaryLabelConfig } from './DietaryLabelChip';

interface DietarySummaryProps {
  confirmedAttendees: DietaryAttendee[];
  declinedAttendees: DietaryAttendee[];
}

export function DietaryAggregation({ attendees }: { attendees: DietaryAttendee[] }) {
  const counts = getDietarySummary(attendees);
  const hasAny = Object.values(counts).some((c) => c > 0);

  if (!hasAny) {
    return <span className="text-sm text-stone-500">No dietary restrictions noted</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STANDARD_DIETARY_LABELS.map((label) => {
        if (counts[label] === 0) return null;
        const config = getDietaryLabelConfig(label);
        return (
          <span
            key={label}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${config.color}`}
          >
            {config.emoji} {config.label}: {counts[label]}
          </span>
        );
      })}
    </div>
  );
}

export default function DietaryAttendeeFilter({
  confirmedAttendees,
  declinedAttendees,
}: DietarySummaryProps) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const filteredConfirmed = selectedLabel
    ? confirmedAttendees.filter((a) => {
        const labels = parseDietaryNotesToLabels(a.dietaryNotes);
        return labels.includes(selectedLabel);
      })
    : confirmedAttendees;

  const filteredDeclined = selectedLabel
    ? declinedAttendees.filter((a) => {
        const labels = parseDietaryNotesToLabels(a.dietaryNotes);
        return labels.includes(selectedLabel);
      })
    : [];

  const now = new Date();

  return (
    <div className="mt-6 rounded-lg bg-stone-50 p-4">
      <div className="flex items-center gap-2 text-lg font-medium text-stone-900">
        <span>📋</span>
        <span>RSVP Summary</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {confirmedAttendees.reduce((sum, r) => sum + r.headcount, 0)}
          </div>
          <div className="text-sm text-stone-500">Attending</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{confirmedAttendees.length}</div>
          <div className="text-sm text-stone-500">Households</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{declinedAttendees.length}</div>
          <div className="text-sm text-stone-500">Declined</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {Object.values(getDietarySummary(confirmedAttendees)).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-sm text-stone-500">Dietary Needs</div>
        </div>
      </div>

      <div className="mt-4">
        <DietaryAggregation attendees={confirmedAttendees} />
      </div>

      <div className="mt-4">
        <DietaryFilter selectedLabel={selectedLabel} onSelectLabel={setSelectedLabel} />
      </div>

      {selectedLabel && (
        <p className="mt-2 text-sm text-stone-500">
          Showing attendees with dietary need:{' '}
          <span className="font-medium">{selectedLabel.replace('_', ' ')}</span>
        </p>
      )}

      {filteredConfirmed.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-medium text-stone-900">Confirmed Attendees</h3>
          <ul className="mt-2 space-y-1">
            {filteredConfirmed.map((rsvp) => {
              const respondedDate = rsvp.respondedAt ? new Date(rsvp.respondedAt) : null;
              const daysAgo = respondedDate
                ? Math.floor((now.getTime() - respondedDate.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const timeAgoStr =
                daysAgo !== null
                  ? daysAgo === 0
                    ? 'today'
                    : daysAgo === 1
                      ? '1 day ago'
                      : `${daysAgo} days ago`
                  : null;
              const labels = parseDietaryNotesToLabels(rsvp.dietaryNotes);

              return (
                <li key={rsvp.id} className="flex flex-wrap items-center gap-2 text-stone-700">
                  <span className="text-green-500">✓</span>
                  <span>{rsvp.user.household?.name || rsvp.user.name}</span>
                  {rsvp.headcount > 1 && (
                    <span className="text-sm text-stone-500">
                      +{rsvp.headcount - 1} guest{rsvp.headcount > 2 ? 's' : ''}
                    </span>
                  )}
                  {labels.map((label) => (
                    <DietaryLabelChip key={label} label={label} size="sm" />
                  ))}
                  {timeAgoStr && <span className="text-xs text-stone-400">({timeAgoStr})</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedLabel && filteredDeclined.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-medium text-stone-900">Declined Attendees</h3>
          <ul className="mt-2 space-y-1">
            {filteredDeclined.map((rsvp) => {
              const labels = parseDietaryNotesToLabels(rsvp.dietaryNotes);
              return (
                <li key={rsvp.id} className="flex flex-wrap items-center gap-2 text-stone-700">
                  <span className="text-red-500">✗</span>
                  <span>{rsvp.user.household?.name || rsvp.user.name}</span>
                  {labels.map((label) => (
                    <DietaryLabelChip key={label} label={label} size="sm" />
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedLabel && filteredConfirmed.length === 0 && (
        <p className="mt-4 text-stone-500">No attendees with this dietary need.</p>
      )}
    </div>
  );
}
