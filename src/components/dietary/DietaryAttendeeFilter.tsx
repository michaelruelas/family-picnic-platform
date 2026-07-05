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
    return <span className="text-muted-foreground text-sm">No dietary restrictions noted</span>;
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
    <div className="bg-secondary/60 mt-6 rounded-lg p-4">
      <div className="text-foreground flex items-center gap-2 text-lg font-medium">
        <span>📋</span>
        <span>RSVP Summary</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-sage text-2xl font-bold">
            {confirmedAttendees.reduce((sum, r) => sum + r.headcount, 0)}
          </div>
          <div className="text-muted-foreground text-sm">Attending</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-terracotta text-2xl font-bold">{confirmedAttendees.length}</div>
          <div className="text-muted-foreground text-sm">Households</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-destructive text-2xl font-bold">{declinedAttendees.length}</div>
          <div className="text-muted-foreground text-sm">Declined</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {Object.values(getDietarySummary(confirmedAttendees)).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-muted-foreground text-sm">Dietary Needs</div>
        </div>
      </div>

      <div className="mt-4">
        <DietaryAggregation attendees={confirmedAttendees} />
      </div>

      <div className="mt-4">
        <DietaryFilter selectedLabel={selectedLabel} onSelectLabel={setSelectedLabel} />
      </div>

      {selectedLabel && (
        <p className="text-muted-foreground mt-2 text-sm">
          Showing attendees with dietary need:{' '}
          <span className="font-medium">{selectedLabel.replace('_', ' ')}</span>
        </p>
      )}

      {filteredConfirmed.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md text-foreground font-medium">Confirmed Attendees</h3>
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
                <li key={rsvp.id} className="text-foreground/85 flex flex-wrap items-center gap-2">
                  <span className="text-sage">✓</span>
                  <span>{rsvp.user.household?.name || rsvp.user.name}</span>
                  {rsvp.headcount > 1 && (
                    <span className="text-muted-foreground text-sm">
                      +{rsvp.headcount - 1} guest{rsvp.headcount > 2 ? 's' : ''}
                    </span>
                  )}
                  {labels.map((label) => (
                    <DietaryLabelChip key={label} label={label} size="sm" />
                  ))}
                  {timeAgoStr && (
                    <span className="text-muted-foreground/70 text-xs">({timeAgoStr})</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedLabel && filteredDeclined.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md text-foreground font-medium">Declined Attendees</h3>
          <ul className="mt-2 space-y-1">
            {filteredDeclined.map((rsvp) => {
              const labels = parseDietaryNotesToLabels(rsvp.dietaryNotes);
              return (
                <li key={rsvp.id} className="text-foreground/85 flex flex-wrap items-center gap-2">
                  <span className="text-destructive">✗</span>
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
        <p className="text-muted-foreground mt-4">No attendees with this dietary need.</p>
      )}
    </div>
  );
}
