'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EventStatus } from '~/lib/generated/enums';
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable';
import EventStatusBadge from '~/components/event/EventStatusBadge';
import { POTLUCK_CATEGORY_LABELS, slotDisplayName } from '~/lib/constants';
import { useToast } from '~/components/ui/Toast';
import { trpc } from '~/lib/trpc-client';
import PotluckSignupEditModal from './PotluckSignupEditModal';
import PotluckSignupCreateModal, {
  type AdminPotluckHouseholdOption,
  type AdminPotluckSlotOption,
} from './PotluckSignupCreateModal';
import PotluckSignupReassignModal from './PotluckSignupReassignModal';

export interface AdminPotluckSignupRow {
  id: string;
  slotId: string;
  slotName: string | null;
  slotCategory: string;
  slotType: 'LIMITED' | 'UNLIMITED';
  slotMaxSignups: number | null;
  slotCurrentSignups: number;
  rsvpId: string;
  userId: string;
  userName: string;
  userEmail: string;
  householdId: string | null;
  householdName: string;
  dishName: string;
  servings: number;
}

interface PotluckSignupsTableProps {
  initialRows: AdminPotluckSignupRow[];
  eventId: string;
  eventStatus: EventStatus;
  eventName: string;
  eventDate: string;
  slots: AdminPotluckSlotOption[];
  households: AdminPotluckHouseholdOption[];
}

export default function PotluckSignupsTable({
  initialRows,
  eventId,
  eventStatus,
  eventName,
  eventDate,
  slots,
  households,
}: PotluckSignupsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [editing, setEditing] = useState<AdminPotluckSignupRow | null>(null);
  const [reassigning, setReassigning] = useState<AdminPotluckSignupRow | null>(null);
  const [cancelling, setCancelling] = useState<AdminPotluckSignupRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const isReadOnly = eventStatus === 'CANCELLED';

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (categoryFilter && row.slotCategory !== categoryFilter) return false;
      if (!needle) return true;
      return (
        row.dishName.toLowerCase().includes(needle) ||
        row.householdName.toLowerCase().includes(needle) ||
        row.userName.toLowerCase().includes(needle) ||
        row.userEmail.toLowerCase().includes(needle) ||
        row.slotName?.toLowerCase().includes(needle)
      );
    });
  }, [initialRows, search, categoryFilter]);

  const cancelMutation = trpc.potluck.adminCancelSignup.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Signup cancelled');
      setCancelling(null);
      router.refresh();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const columns = useMemo<DataTableColumn<AdminPotluckSignupRow>[]>(
    () => [
      {
        id: 'slot',
        header: 'Slot',
        accessorFn: (row) => row.slotCategory,
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-medium">
              {slotDisplayName({ name: row.slotName, category: row.slotCategory })}
            </div>
            <div className="text-muted-foreground text-xs">
              {POTLUCK_CATEGORY_LABELS[row.slotCategory] ?? row.slotCategory}
              {row.slotType === 'LIMITED'
                ? ` · ${row.slotCurrentSignups}/${row.slotMaxSignups}`
                : ` · ${row.slotCurrentSignups}`}
            </div>
          </div>
        ),
      },
      {
        id: 'dish',
        header: 'Dish',
        accessorFn: (row) => row.dishName,
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-medium">
              {row.dishName || <span className="text-muted-foreground/60">—</span>}
            </div>
            <div className="text-muted-foreground text-xs">
              {row.servings} serving{row.servings === 1 ? '' : 's'}
            </div>
          </div>
        ),
      },
      {
        id: 'family',
        header: 'Family',
        accessorFn: (row) => row.householdName,
        enableSorting: true,
        sortFn: 'alphanumeric',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground font-medium">{row.householdName}</div>
            <div className="text-muted-foreground text-xs">
              {row.userName} · {row.userEmail}
            </div>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(row);
              }}
              disabled={isReadOnly}
              className="bg-secondary text-foreground/85 hover:bg-secondary/70 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              data-testid={`edit-${row.id}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReassigning(row);
              }}
              disabled={isReadOnly}
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              data-testid={`reassign-${row.id}`}
            >
              Reassign
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCancelling(row);
              }}
              disabled={isReadOnly}
              className="bg-destructive/15 text-destructive hover:bg-destructive/20 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              data-testid={`cancel-${row.id}`}
            >
              Cancel
            </button>
          </div>
        ),
      },
    ],
    [isReadOnly],
  );

  const totalCategories = useMemo(() => {
    const set = new Set(initialRows.map((r) => r.slotCategory));
    return Array.from(set);
  }, [initialRows]);

  return (
    <div className="space-y-4">
      <div className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-sm p-5 shadow-sm">
        <div>
          <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
            Admin · Potluck
          </p>
          <h2 className="text-foreground mt-1 text-2xl font-bold">{eventName}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{eventDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EventStatusBadge status={eventStatus} />
          {isReadOnly ? null : (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={slots.length === 0 || households.length === 0}
              className="bg-sage text-sage-foreground hover:bg-sage-hover rounded-sm px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              data-testid="add-signup-button"
            >
              + Add signup
            </button>
          )}
          <Link
            href={`/admin/events/${eventId}/edit`}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1.5 text-sm font-medium"
          >
            Back to event
          </Link>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        rowKey="id"
        pageSize={50}
        emptyState={
          initialRows.length === 0
            ? {
                title: 'No signups yet',
                description: 'Once households claim slots, their signups will appear here.',
                icon: 'list',
              }
            : {
                title: 'No signups match the current filters',
                description: 'Clear the search or category filter to see more.',
                icon: 'search',
              }
        }
        toolbar={
          <>
            <div>
              <label
                htmlFor="potluck-search"
                className="text-muted-foreground block text-xs font-medium tracking-wider uppercase"
              >
                Search
              </label>
              <input
                id="potluck-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Dish, household, dietary…"
                className="border-border mt-1 rounded-sm border px-3 py-1.5 text-sm"
                data-testid="potluck-search"
              />
            </div>
            <div>
              <label
                htmlFor="potluck-category-filter"
                className="text-muted-foreground block text-xs font-medium tracking-wider uppercase"
              >
                Category
              </label>
              <select
                id="potluck-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border-border mt-1 rounded-sm border px-3 py-1.5 text-sm"
                data-testid="potluck-category-filter"
              >
                <option value="">All ({initialRows.length})</option>
                {totalCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {POTLUCK_CATEGORY_LABELS[cat] ?? cat} (
                    {initialRows.filter((r) => r.slotCategory === cat).length})
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto self-end text-sm">
              <span className="text-muted-foreground">Matched rows: </span>
              <span className="text-foreground font-semibold" data-testid="potluck-total">
                {filteredRows.length}
              </span>
            </div>
          </>
        }
      />

      {editing ? (
        <PotluckSignupEditModal
          key={`edit-${editing.id}`}
          eventName={eventName}
          signupId={editing.id}
          householdName={editing.householdName}
          userName={editing.userName}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {reassigning ? (
        <PotluckSignupReassignModal
          key={`reassign-${reassigning.id}`}
          eventName={eventName}
          signup={{
            id: reassigning.id,
            dishName: reassigning.dishName,
            householdName: reassigning.householdName,
            slotId: reassigning.slotId,
            rsvpId: reassigning.rsvpId,
          }}
          slots={slots}
          households={households}
          onClose={() => setReassigning(null)}
        />
      ) : null}

      {createOpen ? (
        <PotluckSignupCreateModal
          eventId={eventId}
          eventName={eventName}
          slots={slots}
          households={households}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      {cancelling ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="potluck-cancel-title"
          data-testid="cancel-confirm"
        >
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setCancelling(null)}
            className="bg-foreground/30 fixed inset-0 backdrop-blur-sm"
          />
          <div className="bg-card shadow-pop relative w-full max-w-md rounded-sm p-7 pt-9">
            <h2
              id="potluck-cancel-title"
              className="text-foreground text-2xl font-semibold tracking-tight"
            >
              Cancel signup?
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              This will drop the claim for{' '}
              <span className="text-foreground font-semibold">{cancelling.householdName}</span>
              {cancelling.dishName ? (
                <>
                  {' '}
                  on <span className="text-foreground font-semibold">{cancelling.dishName}</span>
                </>
              ) : null}
              . The slot counter will be decremented. The signup can be re-created later but the
              audit history will be preserved.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelling(null)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Keep signup
              </button>
              <button
                type="button"
                onClick={() => cancelMutation.mutate({ signupId: cancelling.id })}
                disabled={cancelMutation.isPending}
                className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                data-testid="confirm-cancel"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel signup'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
