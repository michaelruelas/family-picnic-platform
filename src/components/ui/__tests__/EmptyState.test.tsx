import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByRole('heading', { name: /no items found/i })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="There is nothing here yet." />);
    expect(screen.getByText('There is nothing here yet.')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="Empty" action={<button>Create</button>} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('renders SVG icon with correct path for calendar icon', () => {
    const { container } = render(<EmptyState title="Test" icon="calendar" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    );
  });

  it('renders SVG icon with correct path for photo icon', () => {
    const { container } = render(<EmptyState title="Test" icon="photo" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    );
  });

  it('renders SVG icon with correct path for users icon', () => {
    const { container } = render(<EmptyState title="Test" icon="users" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    );
  });

  it('renders SVG icon with correct path for list icon', () => {
    const { container } = render(<EmptyState title="Test" icon="list" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    );
  });

  it('renders SVG icon with correct path for search icon', () => {
    const { container } = render(<EmptyState title="Test" icon="search" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute('d', 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');
  });

  it('renders SVG icon with correct path for inbox icon', () => {
    const { container } = render(<EmptyState title="Test" icon="inbox" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    );
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Test" className="my-custom" />);
    expect(container.firstChild).toHaveClass('my-custom');
  });

  it('defaults to inbox icon', () => {
    const { container } = render(<EmptyState title="Test" />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute(
      'd',
      'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    );
  });
});
