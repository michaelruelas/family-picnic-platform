'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EventActionsProps {
  eventId: string;
  status: string;
}

export default function EventActions({ eventId, status }: EventActionsProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await fetch(`/api/admin/events/${eventId}/publish`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await fetch(`/api/admin/events/${eventId}/close`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsClosing(false);
    }
  };

  // FPP-70: re-open flips a CLOSED event back to PUBLISHED so RSVPs
  // are accepted again. Existing RSVPs are untouched and no household
  // is re-notified.
  const handleReopen = async () => {
    setIsReopening(true);
    try {
      await fetch(`/api/admin/events/${eventId}/reopen`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsReopening(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await fetch(`/api/admin/events/${eventId}/cancel`, { method: 'POST' });
      router.refresh();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex gap-2">
      {status === 'DRAFT' && (
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          className="bg-success/15 text-success hover:bg-success/25 rounded-sm px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {isPublishing ? 'Publishing...' : 'Publish'}
        </button>
      )}
      {status === 'PUBLISHED' && (
        <button
          type="button"
          onClick={handleClose}
          disabled={isClosing}
          className="bg-destructive/15 text-destructive hover:bg-destructive/25 rounded-sm px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {isClosing ? 'Closing...' : 'Close RSVPs'}
        </button>
      )}
      {status === 'CLOSED' && (
        <button
          type="button"
          onClick={handleReopen}
          disabled={isReopening}
          className="bg-success/15 text-success hover:bg-success/25 rounded-sm px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {isReopening ? 'Re-opening...' : 'Re-open RSVPs'}
        </button>
      )}
      {status !== 'CLOSED' && status !== 'CANCELLED' && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="bg-secondary text-muted-foreground hover:bg-muted rounded-sm px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Event'}
        </button>
      )}
    </div>
  );
}
