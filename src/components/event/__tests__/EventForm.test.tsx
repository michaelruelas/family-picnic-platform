import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventForm from '../EventForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as never;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('EventForm', () => {
  it('renders empty form in create mode', () => {
    render(<EventForm mode="create" />);
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event date/i)).toBeInTheDocument();
  });

  it('pre-fills fields in edit mode', () => {
    const initialData = {
      id: 'e-1',
      name: 'Annual Picnic',
      date: '2026-08-15T10:00',
      location: 'Central Park',
      lat: null,
      lng: null,
      placeId: null,
      description: 'Family fun',
      rsvpDeadline: '2026-08-01',
      maxCapacity: 50,
      mapImageUrl: 'https://maps.example.com/img.png',
    };
    render(<EventForm mode="edit" initialData={initialData} />);
    expect(screen.getByLabelText(/event name/i)).toHaveValue('Annual Picnic');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Central Park');
    expect(screen.getByLabelText(/event date/i)).toHaveValue('2026-08-15T10:00');
  });

  it('updates form fields on change', () => {
    render(<EventForm mode="create" />);
    const nameInput = screen.getByLabelText(/event name/i);
    fireEvent.change(nameInput, { target: { value: 'New Event' } });
    expect(nameInput).toHaveValue('New Event');
  });

  it('converts maxCapacity to number', () => {
    render(<EventForm mode="create" />);
    const maxCap = screen.getByLabelText(/max capacity/i);
    fireEvent.change(maxCap, { target: { value: '100' } });
    expect(maxCap).toHaveValue(100);
  });

  it('shows error when validation fails', async () => {
    render(<EventForm mode="create" />);
    const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('submits create form with geo fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'e-new' }),
    } as never);
    render(<EventForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/event date/i), {
      target: { value: '2026-08-15T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
    const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/events',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('submits edit form to event id endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'e-1' }),
    } as never);
    const initialData = {
      id: 'e-1',
      name: 'Picnic',
      date: '2026-08-15T10:00',
      location: 'Park',
      lat: null,
      lng: null,
      placeId: null,
      description: '',
    };
    render(<EventForm mode="edit" initialData={initialData} />);
    const form = screen.getByRole('button', { name: /save changes/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/events/e-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('sends lat=null, lng=null, placeId=null on manual input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'e-new' }),
    } as never);
    render(<EventForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/event date/i), {
      target: { value: '2026-08-15T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
    const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      const body = mockFetch.mock.calls[0]![1]!.body as string;
      expect(body).toContain('"lat":null');
      expect(body).toContain('"lng":null');
      expect(body).toContain('"placeId":null');
    });
  });

  it('shows hint when location is typed without autocomplete selection', () => {
    render(<EventForm mode="create" />);
    const input = screen.getByLabelText(/location/i);
    fireEvent.change(input, { target: { value: 'Park' } });
    expect(screen.getByText(/enable the map/i)).toBeInTheDocument();
  });

  it('shows error when API returns failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    } as never);
    render(<EventForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/event date/i), {
      target: { value: '2026-08-15T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
    const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error') as never);
    render(<EventForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/event date/i), {
      target: { value: '2026-08-15T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
    const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('registration fee fields (FPP-16)', () => {
    it('renders the fee dollar input and the min-age input', () => {
      render(<EventForm mode="create" />);
      expect(screen.getByLabelText(/registration fee/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/minimum age for fee/i)).toBeInTheDocument();
    });

    it('pre-fills both fee fields from initialData in edit mode', () => {
      const initialData = {
        id: 'e-1',
        name: 'Annual Picnic',
        date: '2026-08-15T10:00',
        location: 'Park',
        lat: null,
        lng: null,
        placeId: null,
        description: '',
        registrationFeeCents: 2500,
        registrationFeeMinAge: 13,
      };
      render(<EventForm mode="edit" initialData={initialData} />);
      // `type="number"` inputs normalize the rendered value; we only
      // care that the form seeded the cents correctly. Submit will
      // re-emit the payload so the integration test below is the
      // source of truth for cents/min-age.
      expect(screen.getByLabelText(/registration fee/i)).toHaveValue(25);
      expect(screen.getByLabelText(/minimum age for fee/i)).toHaveValue(13);
    });

    it('sends registrationFeeCents and registrationFeeMinAge on submit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'e-new' }),
      } as never);
      render(<EventForm mode="create" />);
      fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
      fireEvent.change(screen.getByLabelText(/event date/i), {
        target: { value: '2026-08-15T10:00' },
      });
      fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
      fireEvent.change(screen.getByLabelText(/registration fee/i), {
        target: { value: '12.50' },
      });
      fireEvent.change(screen.getByLabelText(/minimum age for fee/i), {
        target: { value: '13' },
      });
      const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/events',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"registrationFeeCents":1250'),
          }),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/events',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"registrationFeeMinAge":13'),
          }),
        );
      });
    });

    it('defaults min-age to 0 when the input is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'e-new' }),
      } as never);
      render(<EventForm mode="create" />);
      fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New' } });
      fireEvent.change(screen.getByLabelText(/event date/i), {
        target: { value: '2026-08-15T10:00' },
      });
      fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Park' } });
      fireEvent.change(screen.getByLabelText(/registration fee/i), {
        target: { value: '10' },
      });
      const form = screen.getByRole('button', { name: /create event/i }).closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/events',
          expect.objectContaining({
            body: expect.stringContaining('"registrationFeeMinAge":0'),
          }),
        );
      });
    });
  });
});
