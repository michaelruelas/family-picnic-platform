'use client';

import Link from 'next/link';
import {
  getDietaryLabelConfig,
  STANDARD_DIETARY_LABELS,
} from '~/components/dietary/DietaryLabelChip';

interface RsvpSummary {
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
  headcount: number;
}

interface FoodCategory {
  category: string;
  items: string[];
}

interface DashboardCardProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventStatus: string;
  rsvpSummary: RsvpSummary;
  foodSummary: FoodCategory[];
  dietarySummary?: Record<string, number>;
  maxCapacity?: number | null;
}

export default function DashboardCard({
  eventId,
  eventName,
  eventDate,
  eventStatus,
  rsvpSummary,
  foodSummary,
  dietarySummary,
  maxCapacity,
}: DashboardCardProps) {
  const capacityPercent = maxCapacity
    ? Math.round((rsvpSummary.headcount / maxCapacity) * 100)
    : null;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-stone-100 text-stone-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-stone-900">{eventName}</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[eventStatus] ?? 'bg-stone-100 text-stone-700'}`}
            >
              {eventStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">{eventDate}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/edit`}
          className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-200"
        >
          Manage
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-500">Confirmed</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{rsvpSummary.confirmed}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-500">Headcount</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{rsvpSummary.headcount}</p>
          {capacityPercent !== null && (
            <p className="mt-0.5 text-xs text-stone-400">
              {capacityPercent}% of {maxCapacity}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{rsvpSummary.pending}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-500">Declined</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{rsvpSummary.declined}</p>
        </div>
      </div>

      {foodSummary.length > 0 && (
        <div className="mt-4 rounded-lg bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-700">Potluck Summary</p>
          <div className="mt-2 space-y-2">
            {foodSummary.map((category) => (
              <div key={category.category}>
                <p className="text-xs tracking-wide text-stone-500 uppercase">
                  {category.category}
                </p>
                <p className="mt-0.5 text-sm text-stone-700">
                  {category.items.length > 0
                    ? category.items.slice(0, 3).join(', ')
                    : 'No items yet'}
                  {category.items.length > 3 && (
                    <span className="text-stone-400"> +{category.items.length - 3} more</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {dietarySummary && Object.values(dietarySummary).some((c) => c > 0) && (
        <div className="mt-4 rounded-lg bg-green-50 p-3">
          <p className="text-sm font-medium text-green-700">Dietary Restrictions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STANDARD_DIETARY_LABELS.map((label) => {
              const count = dietarySummary[label] || 0;
              if (count === 0) return null;
              const config = getDietaryLabelConfig(label);
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${config.color}`}
                >
                  {config.emoji} {config.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {eventStatus === 'DRAFT' && (
          <form action={`/api/admin/events/${eventId}/publish`} method="POST">
            <button
              type="submit"
              className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-200"
            >
              Publish
            </button>
          </form>
        )}
        {eventStatus === 'PUBLISHED' && (
          <form action={`/api/admin/events/${eventId}/close`} method="POST">
            <button
              type="submit"
              className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              Close RSVPs
            </button>
          </form>
        )}
        <Link
          href="/admin/communications"
          className="rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200"
        >
          Broadcast
        </Link>
      </div>
    </div>
  );
}
