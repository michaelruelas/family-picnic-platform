'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Modal from '~/components/ui/Modal';
import { trpc } from '~/lib/trpc-client';
import { formatDate } from '~/lib/format-date';
import { useToast } from '~/components/ui/Toast';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  household: { id: string; name: string } | null;
}

export default function UsersTable() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const debounce = useCallback((value: string) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const { data: users, refetch } = trpc.admin.listUsers.useQuery(
    debouncedQuery ? { q: debouncedQuery } : undefined,
  );

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'User deleted');
      setDeleteTarget(null);
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      debounce(value);
    },
    [debounce],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Search by name or email…"
            className="border-border bg-card w-full rounded-sm border py-2 pr-3 pl-10 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          {users?.length ?? '…'} user{users?.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="border-border overflow-x-auto rounded-sm border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-foreground/85 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Household</th>
              <th className="px-4 py-3 font-semibold">Registered</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {users?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                  {debouncedQuery ? 'No users match your search.' : 'No registered users yet.'}
                </td>
              </tr>
            ) : (
              users?.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/50">
                  <td className="text-foreground max-w-[200px] truncate px-4 py-3 font-medium">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-terracotta hover:text-terracotta/80 hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground max-w-[280px] truncate px-4 py-3">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-terracotta/10 text-terracotta rounded-sm px-2 py-0.5 text-xs font-medium">
                      {user.role}
                    </span>
                  </td>
                  <td className="text-muted-foreground max-w-[160px] truncate px-4 py-3">
                    {user.household?.name ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                    {formatDate(user.createdAt, 'date')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-terracotta hover:bg-terracotta/10 rounded-sm px-2 py-1 text-xs font-medium transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-1 text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <Modal isOpen onClose={() => setDeleteTarget(null)} title="Delete user" size="sm">
          <div className="space-y-4">
            <p className="text-foreground">
              Soft-delete <span className="font-semibold">{deleteTarget.name}</span> (
              {deleteTarget.email})?
            </p>
            <p className="text-muted-foreground text-sm">
              The user will no longer be able to sign in. Their RSVPs, photos, and other data will
              be preserved. The email address can be used to register a new account.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteUser.mutate({ userId: deleteTarget.id })}
                disabled={deleteUser.isPending}
                className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleteUser.isPending ? 'Deleting…' : 'Delete user'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
