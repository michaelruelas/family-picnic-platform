'use client';

import { useState } from 'react';
import DataTable, { type DataTableColumn } from './DataTable';
import Input from './Input';
import Button from './Button';
import { formatDate } from '~/lib/format-date';

interface Person {
  id: string;
  name: string;
  age: number;
  role: string;
  email: string;
}

const SAMPLE_PEOPLE: Person[] = [
  { id: 'p1', name: 'Alice Garcia', age: 34, role: 'Parent', email: 'alice@example.com' },
  { id: 'p2', name: 'Bob Thompson', age: 28, role: 'Adult', email: 'bob@example.com' },
  { id: 'p3', name: 'Charlie Patel', age: 42, role: 'Admin', email: 'charlie@example.com' },
  { id: 'p4', name: 'Diana Lee', age: 7, role: 'Child', email: 'diana@example.com' },
  { id: 'p5', name: 'Ethan Wright', age: 65, role: 'Grandparent', email: 'ethan@example.com' },
];

interface Charge {
  id: string;
  amount: number;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  customer: string;
  createdAt: string;
}

const SAMPLE_CHARGES: Charge[] = [
  {
    id: 'c1',
    amount: 5000,
    status: 'SUCCEEDED',
    customer: 'Alice Garcia',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'c2',
    amount: 2500,
    status: 'PENDING',
    customer: 'Bob Thompson',
    createdAt: '2026-08-02T11:30:00Z',
  },
  {
    id: 'c3',
    amount: 0,
    status: 'FAILED',
    customer: 'Charlie Patel',
    createdAt: '2026-08-03T09:15:00Z',
  },
];

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusPalette: Record<Charge['status'], string> = {
  SUCCEEDED: 'bg-sage/20 text-sage',
  PENDING: 'bg-secondary text-foreground/85',
  FAILED: 'bg-destructive/20 text-destructive',
};

export function PeopleTableDemo() {
  const [selected, setSelected] = useState<Person | null>(null);
  const columns: DataTableColumn<Person>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
    {
      id: 'age',
      header: 'Age',
      accessorKey: 'age',
      enableSorting: true,
      sortFn: 'basic',
      align: 'right',
    },
    { id: 'role', header: 'Role', accessorKey: 'role', enableSorting: true },
    { id: 'email', header: 'Email', accessorKey: 'email' },
  ];

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-foreground text-xl font-semibold">People</h2>
        <p className="text-muted-foreground text-sm">
          Click a row to inspect. Sort by clicking column headers. Toggle columns with the "Columns"
          button on the right.
        </p>
      </header>
      {selected ? (
        <div className="bg-sunlight/20 rounded-xl p-3 text-sm">
          <strong>Selected:</strong> {selected.name} ({selected.email}) — age {selected.age}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-terracotta ml-2 underline"
          >
            clear
          </button>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={SAMPLE_PEOPLE}
        rowKey="id"
        onRowClick={(row) => setSelected(row)}
        stickyHeader
      />
    </div>
  );
}

export function ChargesTableDemo() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Charge[]>(SAMPLE_CHARGES);

  const columns: DataTableColumn<Charge>[] = [
    {
      id: 'when',
      header: 'When',
      accessorFn: (row) => row.createdAt,
      cell: ({ value }) => formatDate(value),
      enableSorting: true,
      sortFn: 'datetime',
    },
    { id: 'customer', header: 'Customer', accessorKey: 'customer', enableSorting: true },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      enableSorting: true,
      sortFn: 'basic',
      align: 'right',
      cell: ({ value }) => <span className="font-semibold">{formatAmount(Number(value))}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      enableHiding: false,
      cell: ({ value }) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette[value as Charge['status']]}`}
        >
          {String(value)}
        </span>
      ),
    },
  ];

  function simulateReload() {
    setLoading(true);
    setTimeout(() => {
      setData([...SAMPLE_CHARGES].reverse());
      setLoading(false);
    }, 600);
  }

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-foreground text-xl font-semibold">Charges</h2>
        <p className="text-muted-foreground text-sm">
          Loading state, custom cell renderers, right-aligned numerics.
        </p>
      </header>
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        toolbar={
          <>
            <Button onClick={simulateReload} variant="primary" size="sm">
              Reload
            </Button>
            <span className="text-muted-foreground text-sm">
              {data.length} charge{data.length === 1 ? '' : 's'}
            </span>
          </>
        }
      />
    </div>
  );
}

export function FilterableTableDemo() {
  const [query, setQuery] = useState('');
  const filtered = SAMPLE_PEOPLE.filter((p) =>
    `${p.name} ${p.email} ${p.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  const columns: DataTableColumn<Person>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
    { id: 'role', header: 'Role', accessorKey: 'role', enableSorting: true },
    { id: 'email', header: 'Email', accessorKey: 'email' },
  ];

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-foreground text-xl font-semibold">Filterable list</h2>
        <p className="text-muted-foreground text-sm">
          Toolbar slot, empty state, and custom empty copy.
        </p>
      </header>
      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        stickyHeader
        toolbar={
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, email, or role…"
            className="max-w-sm"
          />
        }
        emptyState={{
          title: 'No matches',
          description: `Nothing matches “${query}”. Try a different search.`,
          icon: 'search',
        }}
      />
    </div>
  );
}

export default function DataTableStories() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 p-8">
      <PeopleTableDemo />
      <ChargesTableDemo />
      <FilterableTableDemo />
    </div>
  );
}
