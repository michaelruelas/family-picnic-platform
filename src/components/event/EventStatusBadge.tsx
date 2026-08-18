'use client';

type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

interface EventStatusBadgeProps {
  status: EventStatus;
}

const statusConfig: Record<EventStatus, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-secondary', text: 'text-foreground/85' },
  PUBLISHED: { label: 'Published', bg: 'bg-sage/20', text: 'text-sage' },
  CLOSED: { label: 'Closed', bg: 'bg-destructive/15', text: 'text-destructive' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-secondary', text: 'text-muted-foreground' },
};

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
