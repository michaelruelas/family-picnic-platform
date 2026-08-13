import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateTimePicker from '../DateTimePicker';

describe('DateTimePicker', () => {
  it('renders a datetime-local input linked to the label', () => {
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Event Date');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveAttribute('name', 'date');
  });

  it('marks the field as required via aria-required and shows a visible asterisk', () => {
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} required />);
    const input = screen.getByLabelText(/event date/i);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has a 48px minimum tap target (min-h-12) and uses the pill radius', () => {
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Event Date');
    expect(input.className).toContain('min-h-12');
    expect(input.className).toContain('rounded-pill');
  });

  it('passes min and max to the underlying input as ISO strings', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value="2026-08-15T10:00"
        onChange={() => {}}
        min="2026-08-01T00:00"
        max="2026-12-31T23:59"
      />,
    );
    const input = screen.getByLabelText('Event Date');
    expect(input).toHaveAttribute('min', '2026-08-01T00:00');
    expect(input).toHaveAttribute('max', '2026-12-31T23:59');
  });

  it('drops empty-string min/max so the browser does not see an invalid date', () => {
    render(
      <DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} min="" max="" />,
    );
    const input = screen.getByLabelText('Event Date');
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Event Date'), {
      target: { value: '2026-08-15T10:00' },
    });
    expect(onChange).toHaveBeenCalledWith('2026-08-15T10:00');
  });

  it('shows the resolved timezone by default', async () => {
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} />);
    const tzLine = await screen.findByText(/time zone:/i);
    expect(tzLine).toBeInTheDocument();
  });

  it('renders the timezone line as a plain paragraph, not a live region', async () => {
    render(<DateTimePicker label="Event Date" name="date" value="" onChange={() => {}} />);
    const tzLine = await screen.findByText(/time zone:/i);
    const liveRegion = tzLine.closest('[aria-live]');
    expect(liveRegion).toBeNull();
  });

  it('uses an explicit timezone when one is provided', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value=""
        onChange={() => {}}
        timezone="America/Los_Angeles"
      />,
    );
    expect(screen.getByText(/Los Angeles/i)).toBeInTheDocument();
  });

  it('hides the timezone line when showTimezone is false', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value=""
        onChange={() => {}}
        showTimezone={false}
      />,
    );
    expect(screen.queryByText(/time zone:/i)).not.toBeInTheDocument();
  });

  it('renders hint text below the input', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value=""
        onChange={() => {}}
        hint="Pick the day the picnic starts."
      />,
    );
    const hint = screen.getByText('Pick the day the picnic starts.');
    expect(hint).toBeInTheDocument();
    const input = screen.getByLabelText('Event Date');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('hint'));
  });

  it('shows the error instead of the hint and sets aria-invalid', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value=""
        onChange={() => {}}
        hint="This is a hint"
        error="This field is required"
      />,
    );
    expect(screen.queryByText('This is a hint')).not.toBeInTheDocument();
    const error = screen.getByText('This field is required');
    expect(error).toBeInTheDocument();
    expect(error).toHaveAttribute('role', 'alert');
    const input = screen.getByLabelText('Event Date');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-destructive');
  });

  it('forwards the disabled prop and styles the input as muted', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value="2026-08-15T10:00"
        onChange={() => {}}
        disabled
      />,
    );
    const input = screen.getByLabelText('Event Date');
    expect(input).toBeDisabled();
    expect(input.className).toContain('disabled:bg-muted');
  });

  it('forwards a custom step to the underlying input', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value="2026-08-15T10:00"
        onChange={() => {}}
        step={300}
      />,
    );
    expect(screen.getByLabelText('Event Date')).toHaveAttribute('step', '300');
  });

  it('forwards data-testid to the underlying input', () => {
    render(
      <DateTimePicker
        label="Event Date"
        name="date"
        value=""
        onChange={() => {}}
        data-testid="event-date"
      />,
    );
    expect(screen.getByTestId('event-date')).toBe(screen.getByLabelText('Event Date'));
  });

  it('honours an explicit id (overriding the name-derived fallback)', () => {
    render(
      <DateTimePicker
        label="Event Date"
        id="custom-date-id"
        name="date"
        value=""
        onChange={() => {}}
      />,
    );
    const input = document.getElementById('custom-date-id');
    expect(input).not.toBeNull();
    expect(input).toBe(screen.getByLabelText('Event Date'));
  });
});
