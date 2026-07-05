'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await fetch(`/api/admin/events/${eventId}/publish`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await fetch(`/api/admin/events/${eventId}/close`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsClosing(false);
    }
  };

  const capacityPercent = maxCapacity
    ? Math.round((rsvpSummary.headcount / maxCapacity) * 100)
    : null;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-secondary text-foreground/85',
    PUBLISHED: 'bg-sage/20 text-sage',
    CLOSED: 'bg-destructive/15 text-destructive',
    CANCELLED: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-lg font-semibold">{eventName}</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[eventStatus] ?? 'bg-secondary text-foreground/85'}`}
            >
              {eventStatus}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{eventDate}</p>
        </div>
        <Link
          href={`/admin/events/${eventId}/edit`}
          className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Manage
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-secondary/60 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Confirmed</p>
          <p className="text-foreground mt-1 text-2xl font-semibold">{rsvpSummary.confirmed}</p>
        </div>
        <div className="bg-secondary/60 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Headcount</p>
          <p className="text-foreground mt-1 text-2xl font-semibold">{rsvpSummary.headcount}</p>
          {capacityPercent !== null && (
            <p className="text-muted-foreground/70 mt-0.5 text-xs">
              {capacityPercent}% of {maxCapacity}
            </p>
          )}
        </div>
        <div className="bg-secondary/60 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Pending</p>
          <p className="text-terracotta mt-1 text-2xl font-semibold">{rsvpSummary.pending}</p>
        </div>
        <div className="bg-secondary/60 rounded-lg p-3">
          <p className="text-muted-foreground text-sm">Declined</p>
          <p className="text-destructive mt-1 text-2xl font-semibold">{rsvpSummary.declined}</p>
        </div>
      </div>

      {foodSummary.length > 0 && (
        <div className="bg-secondary/60 mt-4 rounded-lg p-3">
          <p className="text-foreground/85 text-sm font-medium">Potluck Summary</p>
          <div className="mt-2 space-y-2">
            {foodSummary.map((category) => (
              <div key={category.category}>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {category.category}
                </p>
                <p className="text-foreground/85 mt-0.5 text-sm">
                  {category.items.length > 0
                    ? category.items.slice(0, 3).join(', ')
                    : 'No items yet'}
                  {category.items.length > 3 && (
                    <span className="text-muted-foreground/70">
                      {' '}
                      +{category.items.length - 3} more
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {dietarySummary && Object.values(dietarySummary).some((c) => c > 0) && (
        <div className="bg-sage/15 mt-4 rounded-lg p-3">
          <p className="text-sage text-sm font-medium">Dietary Restrictions</p>
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
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="bg-sage/20 text-sage hover:bg-sage/30 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        )}
        {eventStatus === 'PUBLISHED' && (
          <button
            type="button"
            onClick={handleClose}
            disabled={isClosing}
            className="bg-destructive/15 text-destructive hover:bg-destructive/20 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {isClosing ? 'Closing...' : 'Close RSVPs'}
          </button>
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
