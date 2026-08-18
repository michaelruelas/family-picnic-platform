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
    PUBLISHED: 'bg-sage/20 text-foreground border-success/30 hover:bg-sage/30',
    DRAFT: 'bg-terracotta/15 text-foreground border-sunlight/40 hover:bg-terracotta/20',
    CLOSED: 'bg-secondary text-muted-foreground border-border',
    CANCELLED: 'bg-destructive/15 text-foreground border-destructive/30 line-through',
  };

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block rounded-sm border px-2 py-1 text-xs font-medium transition-colors ${statusColors[event.status] || 'bg-secondary text-muted-foreground'}`}
      title={event.name}
    >
      {event.name}
    </Link>
  );
}
