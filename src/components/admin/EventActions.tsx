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
          className="rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
        >
          {isPublishing ? 'Publishing...' : 'Publish'}
        </button>
      )}
      {status === 'PUBLISHED' && (
        <button
          type="button"
          onClick={handleClose}
          disabled={isClosing}
          className="rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          {isClosing ? 'Closing...' : 'Close RSVPs'}
        </button>
      )}
      {status !== 'CLOSED' && status !== 'CANCELLED' && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Event'}
        </button>
      )}
    </div>
  );
}
