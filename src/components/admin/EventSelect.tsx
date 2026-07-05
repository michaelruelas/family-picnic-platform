'use client';

import { useRouter } from 'next/navigation';

interface EventOption {
  id: string;
  name: string;
  date: Date;
}

interface EventSelectProps {
  events: EventOption[];
  selectedEventId: string;
}

export default function EventSelect({ events, selectedEventId }: EventSelectProps) {
  const router = useRouter();

  return (
    <select
      id="event-select"
      value={selectedEventId}
      onChange={(e) => {
        router.push(`/admin/communications?event=${e.target.value}`);
      }}
      className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full max-w-md rounded-lg shadow-sm"
    >
      <option value="">Select an event...</option>
      {events.map((event) => (
        <option key={event.id} value={event.id}>
          {event.name} (
          {new Date(event.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          )
        </option>
      ))}
    </select>
  );
}
