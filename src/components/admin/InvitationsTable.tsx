'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '~/components/ui/Toast';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import type { InvitationStatus } from '~/lib/generated/enums';

export interface AdminInvitationRow {
  id: string;
  status: InvitationStatus;
  token: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  createdAt: string;
  household: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
}

interface InvitationsTableProps {
  initialInvitations: AdminInvitationRow[];
}

const STATUS_PALETTE: Record<InvitationStatus, string> = {
  PENDING: 'bg-warning/25 text-warning-foreground',
  SENT: 'bg-info/20 text-info',
  DELIVERED: 'bg-success/20 text-success',
  USED: 'bg-secondary text-muted-foreground',
  EXPIRED: 'bg-destructive/15 text-destructive',
};

function truncatedToken(token: string | null): string {
  if (!token) return '—';
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export default function InvitationsTable({ initialInvitations }: InvitationsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resend(id: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/invitations/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const text = await res.text();
        toast.addToast('error', text || 'Failed to resend invitation');
        return;
      }
      toast.addToast('success', 'Invitation re-sent');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function copyToken(token: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        // Fallback for non-secure contexts (e.g. http://) where
        // navigator.clipboard is undefined. We select-and-exec a hidden
        // <textarea> so the user can still copy the token by hand if
        // the browser blocks the API entirely.
        const ta = document.createElement('textarea');
        ta.value = token;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      toast.addToast('success', 'Token copied to clipboard');
    } catch {
      toast.addToast('error', 'Could not copy to clipboard');
    }
  }

  const columns = useMemo<DataTableColumn<AdminInvitationRow>[]>(
    () => [
      {
        id: 'household',
        header: 'Household',
        accessorFn: (row) => row.household?.name ?? row.user?.name ?? '—',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) =>
          row.household ? (
            <div>
              <div className="text-foreground font-medium">{row.household.name}</div>
              <div className="text-muted-foreground text-xs">Household</div>
            </div>
          ) : row.user ? (
            <div>
              <div className="text-foreground font-medium">{row.user.name}</div>
              <div className="text-muted-foreground text-xs">Direct invite</div>
            </div>
          ) : (
            <span className="text-muted-foreground/60">Unknown</span>
          ),
      },
      {
        id: 'email',
        header: 'Email',
        accessorFn: (row) => row.user?.email ?? row.household?.name ?? '',
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => <span className="text-muted-foreground">{row.user?.email ?? '—'}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${STATUS_PALETTE[row.status] ?? 'bg-secondary text-foreground/85'}`}
          >
            {row.status}
          </span>
        ),
      },
      {
        id: 'sentAt',
        header: 'Sent at',
        accessorKey: 'sentAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) =>
          value ? (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {new Date(String(value)).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
      },
      {
        id: 'expiresAt',
        header: 'Expires',
        accessorKey: 'expiresAt',
        enableSorting: true,
        sortFn: 'datetime',
        cell: ({ value }) =>
          value ? (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {new Date(String(value)).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
      },
      {
        id: 'token',
        header: 'Token',
        accessorKey: 'token',
        enableSorting: false,
        cell: ({ row }) =>
          row.token ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void copyToken(row.token!);
              }}
              className="bg-secondary hover:bg-secondary/80 text-foreground/85 rounded-sm px-2 py-1 font-mono text-xs"
              aria-label={`Copy invitation token ${truncatedToken(row.token)}`}
            >
              {truncatedToken(row.token)}
            </button>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        enableHiding: false,
        cell: ({ row }) => {
          if (row.status === 'USED' || row.status === 'EXPIRED') {
            return <span className="text-muted-foreground/60">—</span>;
          }
          return (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void resend(row.id);
                }}
                disabled={busyId === row.id}
                className="bg-info/15 text-info hover:bg-info/25 rounded-sm px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                {busyId === row.id ? 'Sending…' : 'Resend'}
              </button>
            </div>
          );
        },
      },
    ],
    // busyId is the only reactive dep — the row-level callbacks are stable
    // for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId],
  );

  return (
    <DataTable
      columns={columns}
      data={initialInvitations}
      rowKey="id"
      pageSize={50}
      emptyState={{
        title: 'No invitations yet',
        description: 'Select a household above to send an invitation.',
        icon: 'inbox',
      }}
    />
  );
}
