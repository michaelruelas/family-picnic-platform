import Link from 'next/link';

interface EventNavProps {
  eventId: string;
  dishCount: number;
  photoCount?: number;
  active: 'overview' | 'potluck' | 'photos';
}

interface Tab {
  key: 'overview' | 'potluck' | 'photos';
  label: string;
  href: string;
  count: number;
}

export default function EventNav({ eventId, dishCount, photoCount, active }: EventNavProps) {
  const tabs: Tab[] = [
    {
      key: 'overview',
      label: 'Details',
      href: `/events/${eventId}`,
      count: 0,
    },
    {
      key: 'potluck',
      label: 'Potluck',
      href: `/events/${eventId}/potluck`,
      count: dishCount,
    },
    {
      key: 'photos',
      label: 'Gallery',
      href: `/events/${eventId}/photos`,
      count: photoCount ?? 0,
    },
  ];

  return (
    <nav
      aria-label="Event sections"
      className="border-border bg-card/60 mx-auto max-w-6xl rounded-sm border px-2 py-1.5 shadow-sm backdrop-blur"
      data-testid="event-sub-nav"
    >
      <ul className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`event-sub-nav-${tab.key}`}
                data-active={isActive ? 'true' : 'false'}
                className={
                  isActive
                    ? 'bg-foreground text-background flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-medium transition-colors'
                }
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={
                      isActive
                        ? 'bg-background/20 text-background rounded-sm px-2 py-0.5 text-xs font-semibold'
                        : 'bg-secondary text-muted-foreground rounded-sm px-2 py-0.5 text-xs font-semibold'
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
