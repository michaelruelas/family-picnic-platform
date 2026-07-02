'use client';

type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

interface EventStatusBadgeProps {
  status: EventStatus;
}

const statusConfig: Record<EventStatus, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-stone-100', text: 'text-stone-700' },
  PUBLISHED: { label: 'Published', bg: 'bg-green-100', text: 'text-green-700' },
  CLOSED: { label: 'Closed', bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-700' },
};

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
