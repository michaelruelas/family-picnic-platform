interface RsvpLastUpdatedProps {
  modifiedAt: string | Date;
  className?: string;
}

const FORMAT_OPTIONS = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
} as const;

export function RsvpLastUpdated({ modifiedAt, className }: RsvpLastUpdatedProps) {
  const isoString = typeof modifiedAt === 'string' ? modifiedAt : modifiedAt.toISOString();
  const formatted = new Date(isoString).toLocaleString('en-US', FORMAT_OPTIONS);
  const baseClass = 'text-muted-foreground mt-4 text-xs';
  const fullClass = className ? `${baseClass} ${className}` : baseClass;
  return (
    <p className={fullClass}>
      Last updated <time dateTime={isoString}>{formatted}</time>
    </p>
  );
}
