interface RsvpLastUpdatedProps {
  modifiedAt: string | Date;
  className?: string;
}

export function RsvpLastUpdated({ modifiedAt, className }: RsvpLastUpdatedProps) {
  const isoString = typeof modifiedAt === 'string' ? modifiedAt : modifiedAt.toISOString();
  return (
    <p className={`text-muted-foreground text-xs ${className ?? ''}`}>
      Last updated{' '}
      <time dateTime={isoString}>
        {new Date(isoString).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </time>
    </p>
  );
}
