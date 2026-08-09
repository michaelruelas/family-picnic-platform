import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as never;

const { default: ItineraryEditor } = await import('../ItineraryEditor');

beforeEach(() => {
  mockFetch.mockReset();
});

const initialItems = [
  { id: 'i-1', time: '10:00', title: 'Setup', description: 'Bring coolers.', order: 0 },
  { id: 'i-2', time: '12:00', title: 'Lunch', description: null, order: 1 },
];

describe('ItineraryEditor', () => {
  it('renders the initial items sorted by order', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    expect(screen.getByText('Setup')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('shows the empty state when no items are present', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={[]} />);
    expect(screen.getByText('No Itinerary Items Yet')).toBeInTheDocument();
  });

  it('opens the add form when the add button is clicked', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    fireEvent.click(screen.getByTestId('itinerary-add-button'));
    expect(screen.getByTestId('itinerary-add-form')).toBeInTheDocument();
  });

  it('posts a new item and refreshes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'i-new' }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={[]} />);
    fireEvent.click(screen.getByText('Add First Item'));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Opening' } });
    fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Greet the family.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/itinerary-items',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"eventId":"e-1"'),
        }),
      );
      expect(mockFetch.mock.calls[0]![1]!.body).toContain('"title":"Opening"');
      expect(mockFetch.mock.calls[0]![1]!.body).toContain('"time":"09:00"');
    });
  });

  it('shows an error when the add request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Title is required' }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={[]} />);
    fireEvent.click(screen.getByText('Add First Item'));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Opening' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('opens the edit form when Edit is clicked', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]!);
    expect(screen.getByTestId('itinerary-edit-form')).toBeInTheDocument();
  });

  it('patches the item with the updated title', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'i-1' }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]!);
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/itinerary-items/i-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows a delete confirmation when Delete is clicked', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]!);
    expect(screen.getByText(/Confirm Delete/i)).toBeInTheDocument();
  });

  it('deletes the item after confirmation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/itinerary-items/i-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('moves an item down with the down arrow', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const downButtons = screen.getAllByLabelText('Move down');
    fireEvent.click(downButtons[0]!);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/itinerary-items/reorder',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"itemIds":["i-2","i-1"]'),
        }),
      );
    });
  });

  it('moves an item up with the up arrow', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as never);
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const upButtons = screen.getAllByLabelText('Move up');
    fireEvent.click(upButtons[1]!);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/itinerary-items/reorder',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"itemIds":["i-2","i-1"]'),
        }),
      );
    });
  });

  it('disables the up arrow on the first item', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const upButtons = screen.getAllByLabelText('Move up');
    expect(upButtons[0]).toBeDisabled();
    expect(upButtons[1]).not.toBeDisabled();
  });

  it('disables the down arrow on the last item', () => {
    render(<ItineraryEditor eventId="e-1" initialItems={initialItems} />);
    const downButtons = screen.getAllByLabelText('Move down');
    expect(downButtons[0]).not.toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it('renders a "No time" badge when the item has no time', () => {
    render(
      <ItineraryEditor
        eventId="e-1"
        initialItems={[{ id: 'i-1', time: null, title: 'TBD', description: null, order: 0 }]}
      />,
    );
    expect(screen.getByText('No time')).toBeInTheDocument();
  });

  it('formats a 24-hour time string to 12-hour display', () => {
    render(
      <ItineraryEditor
        eventId="e-1"
        initialItems={[{ id: 'i-1', time: '14:30', title: 'Lunch', description: null, order: 0 }]}
      />,
    );
    expect(screen.getByText(/2:30\s*PM/i)).toBeInTheDocument();
  });
});
