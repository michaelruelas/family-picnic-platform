'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Input from '~/components/ui/Input';
import Select from '~/components/ui/Select';
import Button from '~/components/ui/Button';
import { VALID_REACTIONS } from '~/lib/constants';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'most_reacted', label: 'Most Reacted' },
];

export default function PhotoSearch({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [reaction, setReaction] = useState(searchParams.get('reaction') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  const reactionOptions = [
    { value: '', label: 'Any Reaction' },
    ...VALID_REACTIONS.map((r) => ({ value: r, label: r })),
  ];

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (reaction) params.set('reaction', reaction);
    if (sortBy !== 'newest') params.set('sort', sortBy);

    const paramString = params.toString();
    router.push(`/events/${eventId}/photos${paramString ? `?${paramString}` : ''}`);
  }, [query, dateFrom, dateTo, reaction, sortBy, router, eventId]);

  const handleClear = useCallback(() => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setReaction('');
    setSortBy('newest');
    router.push(`/events/${eventId}/photos`);
  }, [router, eventId]);

  return (
    <div className="bg-card rounded-sm p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          type="text"
          placeholder="Search captions or uploader name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
