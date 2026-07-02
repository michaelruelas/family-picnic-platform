'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Button from '~/components/ui/Button';
import { VALID_REACTIONS } from '~/lib/constants';

interface PhotoSearchProps {
  events: { id: string; name: string }[];
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'most_reacted', label: 'Most Reacted' },
];

export default function PhotoSearch({ events }: PhotoSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [eventId, setEventId] = useState(searchParams.get('event') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [reaction, setReaction] = useState(searchParams.get('reaction') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  const eventOptions = [
    { value: '', label: 'All Events' },
    ...events.map((e) => ({ value: e.id, label: e.name })),
  ];

  const reactionOptions = [
    { value: '', label: 'Any Reaction' },
    ...VALID_REACTIONS.map((r) => ({ value: r, label: r })),
  ];

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (eventId) params.set('event', eventId);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (reaction) params.set('reaction', reaction);
    if (sortBy !== 'newest') params.set('sort', sortBy);

    const paramString = params.toString();
    router.push(`/photos${paramString ? `?${paramString}` : ''}`);
  }, [query, eventId, dateFrom, dateTo, reaction, sortBy, router]);

  const handleClear = useCallback(() => {
    setQuery('');
    setEventId('');
    setDateFrom('');
    setDateTo('');
    setReaction('');
    setSortBy('newest');
    router.push('/photos');
  }, [router]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          type="text"
          placeholder="Search captions or uploader name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />

        <Select
          options={eventOptions}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="All Events"
        />

        <Select
          options={reactionOptions}
          value={reaction}
          onChange={(e) => setReaction(e.target.value)}
          placeholder="Any Reaction"
        />

        <Input
          type="date"
          label="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        <Input type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          label="Sort By"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={handleSearch} variant="primary">
          Search
        </Button>
        <Button onClick={handleClear} variant="secondary">
          Clear
        </Button>
      </div>
    </div>
  );
}
