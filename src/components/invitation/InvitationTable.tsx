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
  PENDING: 'bg-yellow-100 text-yellow-700',
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  USED: 'bg-purple-100 text-purple-700',
  EXPIRED: 'bg-red-100 text-red-700',
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
      <div className="rounded-2xl bg-stone-100 p-12 text-center">
        <div className="text-5xl">📬</div>
        <h3 className="mt-4 text-xl font-semibold text-stone-900">No Invitations Yet</h3>
        <p className="mt-2 text-stone-600">
          Send invitations to households or users to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200">
        <thead className="bg-stone-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">
              Recipient
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">
              Type
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">
              Sent At
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">
              Expires
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {invitations.map((invitation) => (
            <tr key={invitation.id} className="hover:bg-stone-50">
              <td className="whitespace-nowrap px-4 py-3">
                {invitation.household ? (
                  <div>
                    <p className="font-medium text-stone-900">{invitation.household.name}</p>
                    <p className="text-sm text-stone-500">Household</p>
                  </div>
                ) : invitation.user ? (
                  <div>
                    <p className="font-medium text-stone-900">{invitation.user.name}</p>
                    <p className="text-sm text-stone-500">{invitation.user.email}</p>
                  </div>
                ) : (
                  <span className="text-stone-400">Unknown</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                {invitation.householdId ? 'Household' : 'User'}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    statusColors[invitation.status] ?? 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {invitation.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                {invitation.sentAt
                  ? new Date(invitation.sentAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                {invitation.expiresAt
                  ? new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
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
                          className="rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
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
