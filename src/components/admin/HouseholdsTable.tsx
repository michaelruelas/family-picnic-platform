'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '~/lib/trpc-client';
import { useToast } from '~/components/ui/Toast';
import Modal from '~/components/ui/Modal';

export default function HouseholdsTable() {
  const toast = useToast();
  const { data: households, refetch } = trpc.admin.listHouseholdsDetail.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const createHousehold = trpc.admin.createHousehold.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Household created');
      setShowCreate(false);
      setCreateName('');
      void refetch();
    },
    onError: (err) => setCreateError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="bg-terracotta hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-medium text-white"
        >
          + New household
        </button>
      </div>

      <div className="border-border overflow-x-auto rounded-sm border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-foreground/85 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Users</th>
              <th className="px-4 py-3 font-semibold">Roster</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {!households || households.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                  No households yet.
                </td>
              </tr>
            ) : (
              households.map((h) => (
                <tr key={h.id} className="hover:bg-secondary/50">
                  <td className="text-foreground px-4 py-3 font-medium">
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-terracotta hover:text-terracotta/80 hover:underline"
                    >
                      {h.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{h._count.users}</td>
                  <td className="text-muted-foreground px-4 py-3">{h._count.members}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/households/${h.id}`}
                      className="text-terracotta hover:bg-terracotta/10 rounded-sm px-2 py-1 text-xs font-medium transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <Modal isOpen onClose={() => setShowCreate(false)} title="Create household" size="sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createName.trim()) {
                createHousehold.mutate({ name: createName.trim() });
              }
            }}
            className="space-y-4"
          >
            {createError ? (
              <p className="text-destructive rounded-sm bg-red-50 px-3 py-2 text-sm">{createError}</p>
            ) : null}
            <label className="block">
              <span className="text-foreground text-sm font-medium">Household name</span>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                placeholder="e.g. The Garcia Family"
                required
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createHousehold.isPending}
                className="bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createHousehold.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}