'use client';

import Link from 'next/link';
import { EventStatus } from '~/lib/generated/enums';

interface CalendarEventChipProps {
  event: {
    id: string;
    name: string;
    date: Date | string;
    status: EventStatus;
  };
}

export function CalendarEventChip({ event }: CalendarEventChipProps) {
  const statusColors: Record<EventStatus, string> = {
    PUBLISHED: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
    DRAFT: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    CLOSED: 'bg-stone-100 text-stone-600 border-stone-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200 line-through',
  };

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block rounded-md border px-2 py-1 text-xs font-medium transition-colors ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}
      title={event.name}
    >
      {event.name}
    </Link>
  );
}
