'use client';

import { useState } from 'react';

type InvitationWithRelations = {
  id: string;
  eventId: string;
  householdId: string | null;
  userId: string | null;
  status: string;
  token: string | null;
  expiresAt: Date | string | null;
  sentAt: Date | string | null;
  createdAt: Date | string;
  household: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
};

type InvitationTableProps = {
  invitations: InvitationWithRelations[];
  onResend: (id: string) => Promise<void>;
  onTrackDelivery: (id: string, status: 'PENDING' | 'SENT' | 'DELIVERED') => Promise<void>;
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-sunlight/30 text-[#a07c2f]',
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-sage/20 text-sage',
  USED: 'bg-purple-100 text-purple-700',
  EXPIRED: 'bg-destructive/15 text-destructive',
};

export default function InvitationTable({
  invitations,
  onResend,
  onTrackDelivery,
}: InvitationTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleResend = async (id: string) => {
    setLoading(id);
    try {
      await onResend(id);
    } finally {
      setLoading(null);
    }
  };

  const handleTrackDelivery = async (id: string, status: 'PENDING' | 'SENT' | 'DELIVERED') => {
    setLoading(id);
    try {
      await onTrackDelivery(id, status);
    } finally {
      setLoading(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="bg-secondary rounded-2xl p-12 text-center">
        <div className="text-5xl">📬</div>
        <h3 className="text-foreground mt-4 text-xl font-semibold">No Invitations Yet</h3>
        <p className="text-muted-foreground mt-2">
          Send invitations to households or users to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200">
        <thead className="bg-secondary/60">
          <tr>
            <th className="text-foreground/85 px-4 py-3 text-left text-sm font-semibold">
              Recipient
            </th>
            <th className="text-foreground/85 px-4 py-3 text-left text-sm font-semibold">Type</th>
            <th className="text-foreground/85 px-4 py-3 text-left text-sm font-semibold">Status</th>
            <th className="text-foreground/85 px-4 py-3 text-left text-sm font-semibold">
              Sent At
            </th>
            <th className="text-foreground/85 px-4 py-3 text-left text-sm font-semibold">
              Expires
            </th>
            <th className="text-foreground/85 px-4 py-3 text-right text-sm font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {invitations.map((invitation) => (
            <tr key={invitation.id} className="hover:bg-secondary/60">
              <td className="px-4 py-3 whitespace-nowrap">
                {invitation.household ? (
                  <div>
                    <p className="text-foreground font-medium">{invitation.household.name}</p>
                    <p className="text-muted-foreground text-sm">Household</p>
                  </div>
                ) : invitation.user ? (
                  <div>
                    <p className="text-foreground font-medium">{invitation.user.name}</p>
                    <p className="text-muted-foreground text-sm">{invitation.user.email}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground/70">Unknown</span>
                )}
              </td>
              <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                {invitation.householdId ? 'Household' : 'User'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    statusColors[invitation.status] ?? 'bg-secondary text-foreground/85'
                  }`}
                >
                  {invitation.status}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                {invitation.sentAt
                  ? new Date(invitation.sentAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
              </td>
              <td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
                {invitation.expiresAt
                  ? new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  {invitation.status !== 'USED' && invitation.status !== 'EXPIRED' && (
                    <>
                      <button
                        onClick={() => handleResend(invitation.id)}
                        disabled={loading === invitation.id}
                        className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                      >
                        {loading === invitation.id ? 'Sending...' : 'Resend'}
                      </button>
                      {invitation.status === 'SENT' && (
                        <button
                          onClick={() => handleTrackDelivery(invitation.id, 'DELIVERED')}
                          disabled={loading === invitation.id}
                          className="bg-sage/20 text-sage hover:bg-sage/30 rounded-lg px-3 py-1 text-sm font-medium disabled:opacity-50"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
