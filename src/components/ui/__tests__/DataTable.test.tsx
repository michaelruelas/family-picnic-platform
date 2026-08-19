import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StrictMode } from 'react';
import DataTable, { type DataTableColumn } from '../DataTable';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockReplace = vi.fn();
const stableRouter = { push: mockPush, refresh: mockRefresh, replace: mockReplace };
let mockSearchParams = new URLSearchParams();
let mockPathname = '/admin/test';

vi.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

interface Person {
  id: string;
  name: string;
  age: number;
  email: string;
}

const sampleData: Person[] = [
  { id: 'p1', name: 'Alice', age: 30, email: 'alice@example.com' },
  { id: 'p2', name: 'Bob', age: 25, email: 'bob@example.com' },
  { id: 'p3', name: 'Charlie', age: 35, email: 'charlie@example.com' },
];

const baseColumns: DataTableColumn<Person>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
  { id: 'age', header: 'Age', accessorKey: 'age', enableSorting: true, align: 'right' },
  { id: 'email', header: 'Email', accessorKey: 'email' },
];

beforeEach(() => {
  mockPush.mockReset();
  mockSearchParams = new URLSearchParams();
  mockPathname = '/admin/test';
});

describe('DataTable', () => {
  it('renders rows and columns from data', () => {
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" />);

    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /age/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(1 + sampleData.length);
  });

  it('renders custom cell content via cell renderer', () => {
    const columns: DataTableColumn<Person>[] = [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      {
        id: 'badge',
        header: 'Status',
        accessorFn: (row) => row.age,
        cell: ({ value }) => <span data-testid="badge">{String(value)}</span>,
      },
    ];

    render(<DataTable columns={columns} data={sampleData} rowKey="id" />);
    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveTextContent('30');
  });

  it('shows empty state when data is empty', () => {
    render(
      <DataTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        emptyState={{ title: 'No people yet', description: 'Add your first record.' }}
      />,
    );
    expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no people yet/i })).toBeInTheDocument();
    expect(screen.getByText(/add your first record/i)).toBeInTheDocument();
  });

  it('shows default empty state when no emptyState prop is provided', () => {
    render(<DataTable columns={baseColumns} data={[]} rowKey="id" />);
    expect(screen.getByRole('heading', { name: /no results/i })).toBeInTheDocument();
  });

  it('shows loading state when loading is true', () => {
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" loading />);
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('calls onRowClick with the row data when a row is clicked', () => {
    const handleClick = vi.fn();
    render(
      <DataTable columns={baseColumns} data={sampleData} rowKey="id" onRowClick={handleClick} />,
    );
    const row = screen.getByText('Alice').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(handleClick).toHaveBeenCalledWith(sampleData[0]);
  });

  it('sort toggle updates URL when syncWithUrl is enabled', () => {
    mockPathname = '/admin/people';
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" syncWithUrl />);

    const nameHeader = screen.getByRole('button', { name: /sort by name/i });
    expect(nameHeader).toBeInTheDocument();

    act(() => {
      fireEvent.click(nameHeader);
    });

    expect(mockPush).toHaveBeenCalled();
    const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1]!;
    const url = lastCall[0] as string;
    expect(url).toContain('/admin/people');
    expect(url).toContain('sort=name');
    expect(url).toContain('sortDir=asc');
  });

  it('re-renders rows in sorted order after sort toggle', () => {
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" />);

    const nameButton = screen.getByRole('button', { name: /sort by name/i });
    fireEvent.click(nameButton);

    const bodyRows = screen.getAllByRole('row').slice(1);
    const firstNameCell = bodyRows[0]?.querySelector('td')?.textContent;
    expect(firstNameCell).toBe('Alice');
  });

  it('renders pagination controls when data exceeds pageSize', () => {
    const largeData: Person[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      name: `Person ${i}`,
      age: 20 + i,
      email: `p${i}@example.com`,
    }));
    render(<DataTable columns={baseColumns} data={largeData} rowKey="id" pageSize={10} />);
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent(/page 1 of 3/i);
  });

  it('does not render pagination when data fits in pageSize', () => {
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" pageSize={25} />);
    expect(screen.queryByTestId('pagination-summary')).not.toBeInTheDocument();
  });

  it('sorts numeric columns in numeric order when sortFn is basic', () => {
    const numericData = [
      { id: 'n1', name: 'ten', value: 10 },
      { id: 'n2', name: 'one', value: 1 },
      { id: 'n3', name: 'two', value: 2 },
    ];
    const cols: DataTableColumn<(typeof numericData)[number]>[] = [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      {
        id: 'value',
        header: 'Value',
        accessorKey: 'value',
        enableSorting: true,
        sortFn: 'basic',
      },
    ];
    render(<DataTable columns={cols} data={numericData} rowKey="id" />);

    const valueButton = screen.getByRole('button', { name: /sort by value/i });
    // first click -> desc, second click -> asc
    fireEvent.click(valueButton);
    fireEvent.click(valueButton);

    const bodyRows = screen.getAllByRole('row').slice(1);
    const values = bodyRows.map((r) => r.querySelector('td:last-child')?.textContent);
    expect(values).toEqual(['1', '2', '10']);
  });

  it('does not push to the router on re-render when state has not changed', () => {
    mockPathname = '/admin/people';
    const { rerender } = render(
      <DataTable columns={baseColumns} data={sampleData} rowKey="id" syncWithUrl />,
    );

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /sort by name/i }));
    });
    const pushCountAfterSort = mockPush.mock.calls.length;
    expect(pushCountAfterSort).toBeGreaterThan(0);

    rerender(<DataTable columns={baseColumns} data={sampleData} rowKey="id" syncWithUrl />);
    rerender(<DataTable columns={baseColumns} data={sampleData} rowKey="id" syncWithUrl />);

    expect(mockPush.mock.calls.length).toBe(pushCountAfterSort);
  });

  it('does not push to the router on initial mount when syncWithUrl is enabled', () => {
    mockPathname = '/admin/people';
    render(<DataTable columns={baseColumns} data={sampleData} rowKey="id" syncWithUrl />);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not push an unchanged URL when effects run again', () => {
    mockPathname = '/admin/audit-log';
    const { rerender } = render(
      <StrictMode>
        <DataTable
          columns={baseColumns}
          data={sampleData}
          rowKey="id"
          syncWithUrl
          paramPrefix="audit_"
        />
      </StrictMode>,
    );

    expect(mockPush).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /sort by name/i }));
    });
    expect(mockPush).toHaveBeenCalledTimes(1);

    mockSearchParams = new URLSearchParams('audit_sort=name&audit_sortDir=asc');
    rerender(
      <StrictMode>
        <DataTable
          columns={baseColumns}
          data={sampleData}
          rowKey="id"
          syncWithUrl
          paramPrefix="audit_"
        />
      </StrictMode>,
    );

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('clamps the page index to 0 when the data shrinks below the current page', () => {
    const largeData: Person[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      name: `Person ${i}`,
      age: 20 + i,
      email: `p${i}@example.com`,
    }));

    const { rerender } = render(
      <DataTable columns={baseColumns} data={largeData} rowKey="id" pageSize={10} />,
    );

    // Navigate to page 3 of 3.
    const nextBtn = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent(/page 3 of 3/i);

    // Data shrinks to 15 rows (2 pages) — page 3 no longer exists.
    const smallData: Person[] = largeData.slice(0, 15);
    rerender(<DataTable columns={baseColumns} data={smallData} rowKey="id" pageSize={10} />);

    // The user should land on page 1, not stuck on a blank page 3.
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent(/page 1 of 2/i);
  });

  it('toggles column visibility from the column toggle menu', () => {
    const cols: DataTableColumn<Person>[] = [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      { id: 'age', header: 'Age', accessorKey: 'age' },
      { id: 'email', header: 'Email', accessorKey: 'email' },
    ];
    render(<DataTable columns={cols} data={sampleData} rowKey="id" />);

    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('column-toggle'));
    const emailToggle = screen.getByRole('checkbox', { name: /toggle email column/i });
    expect(emailToggle).toBeChecked();
    fireEvent.click(emailToggle);

    expect(screen.queryByRole('columnheader', { name: /email/i })).not.toBeInTheDocument();
  });

  it('applies the sticky positioning class when stickyHeader is true', () => {
    const { container } = render(
      <DataTable columns={baseColumns} data={sampleData} rowKey="id" stickyHeader />,
    );
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    expect(thead!.className).toContain('sticky');
    expect(thead!.className).toContain('top-0');
  });

  it('applies the cursor-pointer class when onRowClick is provided', () => {
    const { container } = render(
      <DataTable columns={baseColumns} data={sampleData} rowKey="id" onRowClick={() => {}} />,
    );
    const firstBodyRow = container.querySelector('tbody tr');
    expect(firstBodyRow).not.toBeNull();
    expect(firstBodyRow!.className).toContain('cursor-pointer');
  });
});
