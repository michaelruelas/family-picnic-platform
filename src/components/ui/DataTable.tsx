'use client';

import { flexRender, type SortingState } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import type { ColumnDef, RowData, StockFeatures } from '@tanstack/table-core';

// TODO(tanstack-v10): migrate off useLegacyTable. The v9 `legacy` entry point
// is a v7 compat shim; new v10 code should use the explicit
// `tableFeatures({ ... })` + `useTable()` pattern. The `StockFeatures` generic
// below is tied to that legacy shim and will go away with it.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

export type DataTableAlign = 'left' | 'right' | 'center';

export type DataTableSortFn =
  | 'auto'
  | 'alphanumeric'
  | 'alphanumericCaseSensitive'
  | 'basic'
  | 'datetime'
  | 'text'
  | 'textCaseSensitive';

/**
 * A column descriptor. Intentionally narrower than TanStack's `ColumnDef` —
 * we expose only what the two current consumers (ChargesTable, AuditLogTable)
 * need. The fields below are NOT supported today:
 *
 * - `filterFn` / column filtering — filter the data upstream and pass the
 *   already-filtered array.
 * - `meta` / per-column metadata — use the `className` field for layout
 *   tweaks; richer meta needs a return to TanStack's full surface.
 * - `aggregationFn` / row aggregation — not used yet.
 * - `enableGlobalFilter` — global search is a wrapper-level concern.
 * - Row selection (`enableRowSelection`) — when we need checkboxes, drop the
 *   primitive and lift selection state above it.
 * - `size` / column resizing — the layout is fixed for now.
 * - `sortDescFirst` — defaults to TanStack's text-vs-number heuristic.
 *   Add this once a consumer needs a numeric column to default-desc.
 *
 * If you need one of the above, lift the cap deliberately rather than
 * threading it through one column at a time.
 */
export interface DataTableColumn<TData, TValue = unknown> {
  id: string;
  header: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => TValue;
  cell?: (ctx: { value: TValue; row: TData; rowIndex: number }) => React.ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
  sortFn?: DataTableSortFn;
  align?: DataTableAlign;
  className?: string;
}

export interface DataTableEmptyState {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: 'calendar' | 'photo' | 'users' | 'list' | 'search' | 'inbox' | 'sparkle' | 'archive';
}

export interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  rowKey: keyof TData & string;
  onRowClick?: (row: TData) => void;
  toolbar?: React.ReactNode;
  pageSize?: number;
  stickyHeader?: boolean;
  loading?: boolean;
  emptyState?: DataTableEmptyState;
  syncWithUrl?: boolean;
  paramPrefix?: string;
  className?: string;
}

interface ColumnDisplayMeta {
  align: DataTableAlign;
  className: string;
  header: string;
  canHide: boolean;
}

const alignClass: Record<DataTableAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function buildColumnDefs<TData extends RowData, TValue = unknown>(
  columns: DataTableColumn<TData, TValue>[],
): {
  defs: ColumnDef<StockFeatures, TData, TValue>[];
  metaById: Map<string, ColumnDisplayMeta>;
} {
  const metaById = new Map<string, ColumnDisplayMeta>();
  const defs: ColumnDef<StockFeatures, TData, TValue>[] = columns.map((col) => {
    const def: Record<string, unknown> = {
      id: col.id,
      header: col.header,
      enableSorting: col.enableSorting ?? false,
      enableHiding: col.enableHiding ?? true,
    };
    if (col.sortFn) {
      def.sortFn = col.sortFn;
    }
    if (col.accessorFn) {
      def.accessorFn = col.accessorFn;
    } else if (col.accessorKey) {
      def.accessorKey = col.accessorKey as string;
    }
    if (col.cell) {
      const cellFn = col.cell;
      def.cell = (ctx: { getValue: () => unknown; row: { original: TData; index: number } }) =>
        cellFn({
          value: ctx.getValue() as TValue,
          row: ctx.row.original,
          rowIndex: ctx.row.index,
        });
    }
    metaById.set(col.id, {
      align: col.align ?? 'left',
      className: col.className ?? '',
      header: col.header,
      canHide: col.enableHiding ?? true,
    });
    return def as unknown as ColumnDef<StockFeatures, TData, TValue>;
  });
  return { defs, metaById };
}

export default function DataTable<TData extends RowData>({
  columns,
  data,
  rowKey,
  onRowClick,
  toolbar,
  pageSize = 25,
  stickyHeader = false,
  loading = false,
  emptyState,
  syncWithUrl = false,
  paramPrefix,
  className = '',
}: DataTableProps<TData>) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '_');
  const effectivePrefix = paramPrefix ?? `dt_${instanceId}_`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const sortKey = `${effectivePrefix}sort`;
  const sortDirKey = `${effectivePrefix}sortDir`;
  const pageKey = `${effectivePrefix}page`;

  const { defs: columnDefs, metaById } = useMemo(() => buildColumnDefs(columns), [columns]);

  const initialSorting = useMemo<SortingState>(() => {
    if (!syncWithUrl) return [];
    const id = searchParams.get(sortKey);
    const desc = searchParams.get(sortDirKey) === 'desc';
    if (!id) return [];
    return [{ id, desc }];
  }, [syncWithUrl, searchParams, sortKey, sortDirKey]);

  const initialPageIndex = useMemo(() => {
    if (!syncWithUrl) return 0;
    const raw = searchParams.get(pageKey);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : 0;
  }, [syncWithUrl, searchParams, pageKey]);

  const getRowId = useCallback(
    (row: TData, index: number) => {
      const value = (row as Record<string, unknown>)[rowKey];
      if (value === null || value === undefined) {
        // Dev-only signal: a missing rowKey usually means the consumer passed
        // the wrong column name to `rowKey`, or a row slipped through without
        // a stable id. Production builds can quiet this with a `process.env`
        // gate; for now the log only fires in dev where the noise is helpful.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[DataTable] Row at index ${index} has no value for rowKey "${rowKey}". ` +
              `Falling back to a positional id; sort/selection state will not survive a reorder.`,
          );
        }
        return `row-${index}`;
      }
      return String(value);
    },
    [rowKey],
  );

  const table = useLegacyTable<TData>({
    data,
    columns: columnDefs,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      sorting: initialSorting,
      pagination: { pageIndex: initialPageIndex, pageSize },
    },
  });

  const currentSort = table.getState().sorting[0];
  const currentSortId = currentSort?.id ?? null;
  const currentSortDesc = currentSort?.desc ?? null;
  const currentPageIndex = table.getState().pagination.pageIndex;

  useEffect(() => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams(searchParamsString);
    if (currentSortId) {
      params.set(sortKey, currentSortId);
      params.set(sortDirKey, currentSortDesc ? 'desc' : 'asc');
    } else {
      params.delete(sortKey);
      params.delete(sortDirKey);
    }
    if (currentPageIndex > 0) {
      params.set(pageKey, String(currentPageIndex + 1));
    } else {
      params.delete(pageKey);
    }
    const query = params.toString();
    if (query === searchParamsString) return;
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [
    currentSortId,
    currentSortDesc,
    currentPageIndex,
    syncWithUrl,
    pathname,
    router,
    searchParamsString,
    sortKey,
    sortDirKey,
    pageKey,
  ]);

  // Clamp the page index when data shrinks (filter applied, deep-link to a
  // page that no longer exists). Without this, the user lands on a blank
  // <tbody> with the footer reading "Page 4 of 1".
  useEffect(() => {
    const pageCount = table.getPageCount();
    if (currentPageIndex >= pageCount && pageCount > 0) {
      table.setPageIndex(0);
    }
  }, [table, currentPageIndex, data.length]);

  const isEmpty = !loading && data.length === 0;
  const showPagination = !loading && !isEmpty && data.length > pageSize;

  const hideableColumns = useMemo(
    () =>
      Array.from(metaById.entries())
        .filter(([, meta]) => meta.canHide)
        .map(([id, meta]) => ({ id, header: meta.header })),
    [metaById],
  );
  const showColumnToggle = hideableColumns.length > 1;
  const [columnsOpen, setColumnsOpen] = useState(false);

  return (
    <div className={`space-y-4 ${className}`} data-testid="data-table">
      {(toolbar || showColumnToggle) && (
        <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-sm p-3 shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">{toolbar}</div>
          {showColumnToggle ? (
            <ColumnToggle
              open={columnsOpen}
              onToggle={() => setColumnsOpen((v) => !v)}
              onClose={() => setColumnsOpen(false)}
              columns={hideableColumns}
              isVisible={(id) => table.getColumn(id)?.getIsVisible() !== false}
              onToggleColumn={(id) => table.getColumn(id)?.toggleVisibility()}
            />
          ) : null}
        </div>
      )}

      <div className="bg-card overflow-x-auto rounded-sm shadow-sm">
        {loading ? (
          <div className="p-12" data-testid="data-table-loading">
            <Spinner size="lg" label="Loading…" />
          </div>
        ) : isEmpty ? (
          <div className="p-6" data-testid="data-table-empty">
            {emptyState ? (
              <EmptyState {...emptyState} />
            ) : (
              <EmptyState title="No results" description="Nothing to show here yet." />
            )}
          </div>
        ) : (
          <table className="divide-border min-w-full divide-y">
            <thead className={`bg-secondary/60 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    if (!header.column.getIsVisible()) return null;
                    const meta = metaById.get(header.column.id) ?? {
                      align: 'left' as DataTableAlign,
                      className: '',
                      header: '',
                      canHide: true,
                    };
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={`text-muted-foreground px-4 py-3 text-xs font-medium tracking-wider uppercase ${alignClass[meta.align]} ${meta.className}`}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="hover:text-foreground inline-flex items-center gap-1"
                            aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIndicator direction={sortDir} />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-border divide-y">
              {table.getRowModel().rows.map((row) => {
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-secondary/40 ${clickable ? 'cursor-pointer' : ''}`}
                    onClick={clickable ? () => onRowClick!(row.original) : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick!(row.original);
                            }
                          }
                        : undefined
                    }
                    data-row-id={row.id}
                  >
                    {row.getVisibleCells().map((cell) => {
                      if (!cell.column.getIsVisible()) return null;
                      const meta = metaById.get(cell.column.id) ?? {
                        align: 'left' as DataTableAlign,
                        className: '',
                        header: '',
                        canHide: true,
                      };
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-3 text-sm ${alignClass[meta.align]} ${meta.className}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showPagination ? <PaginationControls table={table} /> : null}
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') {
    return (
      <span aria-hidden="true" data-testid="sort-indicator-asc">
        ▲
      </span>
    );
  }
  if (direction === 'desc') {
    return (
      <span aria-hidden="true" data-testid="sort-indicator-desc">
        ▼
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="text-muted-foreground/50" data-testid="sort-indicator-none">
      ↕
    </span>
  );
}

function ColumnToggle({
  open,
  onToggle,
  onClose,
  columns,
  isVisible,
  onToggleColumn,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  columns: { id: string; header: string }[];
  isVisible: (id: string) => boolean;
  onToggleColumn: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium"
        data-testid="column-toggle"
      >
        Columns
      </button>
      {open ? (
        <div
          role="menu"
          className="border-border bg-card absolute right-0 z-20 mt-1 w-56 rounded-sm border p-2 shadow-lg"
          data-testid="column-toggle-menu"
        >
          {columns.map((col) => (
            <label
              key={col.id}
              className="hover:bg-secondary flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={isVisible(col.id)}
                onChange={() => onToggleColumn(col.id)}
                aria-label={`Toggle ${col.header} column`}
              />
              <span>{col.header}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaginationControls<TData extends RowData>({
  table,
}: {
  table: ReturnType<typeof useLegacyTable<TData>>;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const canPrev = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();
  return (
    <div className="bg-card flex items-center justify-between rounded-sm px-4 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground" data-testid="pagination-summary">
        Page {pageIndex + 1} of {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!canPrev}
          className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!canPrev}
          className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!canNext}
          className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          aria-label="Next page"
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!canNext}
          className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
