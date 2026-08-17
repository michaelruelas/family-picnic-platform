'use client';

import { useState } from 'react';
import Modal from '~/components/ui/Modal';
import { trpc } from '~/lib/trpc-client';

interface ForfeitDialogProps {
  registrationId: string;
  eventName: string;
  attendeeName: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function ForfeitDialog({
  registrationId,
  eventName,
  attendeeName,
  onClose,
  onComplete,
}: ForfeitDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const forfeit = trpc.admin.forfeit.useMutation({
    onSuccess: () => onComplete(),
    onError: (err) => setError(err.message),
  });

  return (
    <Modal isOpen onClose={onClose} title="Forfeit registration" size="md">
      <div className="space-y-4">
        <p className="text-foreground">
          Forfeit <span className="font-semibold">{attendeeName}</span>&apos;s registration for{' '}
          <span className="font-semibold">{eventName}</span>?
        </p>
        <p className="text-muted-foreground text-sm">
          Forfeit marks the registration as closed without returning the payment. Use this for
          no-shows or last-minute cancellations. Issue a refund instead if you want the money
          returned.
        </p>

        <label className="block">
          <span className="text-foreground text-sm font-medium">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
            placeholder="no-show, cancelled, etc."
          />
        </label>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              forfeit.mutate({
                registrationId,
                ...(reason ? { reason } : {}),
              })
            }
            disabled={forfeit.isPending}
            className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="forfeit-submit"
          >
            {forfeit.isPending ? 'Forfeiting…' : 'Forfeit registration'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
