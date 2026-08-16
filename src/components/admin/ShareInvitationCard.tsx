'use client';

import { useState } from 'react';
import { useToast } from '~/components/ui/Toast';

interface ShareInvitationCardProps {
  eventId: string;
}

export default function ShareInvitationCard({ eventId }: ShareInvitationCardProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const getUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/events/${eventId}/rsvp`;
    }
    return `/events/${eventId}/rsvp`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      toast.addToast('success', 'Invitation link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.addToast('error', 'Failed to copy link');
    }
  };

  return (
    <div className="bg-sunlight/15 ring-sunlight/30 rounded-2xl p-6 ring-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-wider uppercase">
            Universal Invitation Link
          </p>
          <h3 className="font-display text-foreground mt-1 text-xl font-semibold">
            Share this link with attendees
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Anyone with this link can view event details and submit their RSVP directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-pill bg-terracotta press px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf6c52]"
            data-testid="copy-invitation-url-button"
          >
            {copied ? '✓ Copied!' : 'Copy Invitation Link'}
          </button>
          <a
            href={`/events/${eventId}/rsvp`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-pill border-border bg-card text-foreground hover:bg-secondary press border px-4 py-2.5 text-sm font-semibold transition-all"
          >
            Preview ↗
          </a>
        </div>
      </div>
    </div>
  );
}
