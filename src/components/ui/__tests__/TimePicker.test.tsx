import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimePicker from '../TimePicker';

describe('TimePicker', () => {
  it('renders a time input linked to the label', () => {
    render(<TimePicker label="Start time" name="start" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Start time');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveAttribute('name', 'start');
  });

  it('has a 48px minimum tap target and uses the pill radius', () => {
    render(<TimePicker label="Start time" name="start" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Start time');
    expect(input.className).toContain('min-h-12');
    expect(input.className).toContain('rounded-sm');
  });

  it('marks the field as required when requested', () => {
    render(<TimePicker label="Start time" name="start" value="" onChange={() => {}} required />);
    const input = screen.getByLabelText(/start time/i);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('passes min and max to the underlying input', () => {
    render(
      <TimePicker
        label="Start time"
        name="start"
        value="10:00"
        onChange={() => {}}
        min="08:00"
        max="20:00"
      />,
    );
    const input = screen.getByLabelText('Start time');
    expect(input).toHaveAttribute('min', '08:00');
    expect(input).toHaveAttribute('max', '20:00');
  });

  it('drops empty-string min/max', () => {
    render(
      <TimePicker label="Start time" name="start" value="" onChange={() => {}} min="" max="" />,
    );
    const input = screen.getByLabelText('Start time');
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(<TimePicker label="Start time" name="start" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:30' } });
    expect(onChange).toHaveBeenCalledWith('09:30');
  });

  it('renders hint text below the input', () => {
    render(
      <TimePicker
        label="Start time"
        name="start"
        value=""
        onChange={() => {}}
        hint="Local clock for the event."
      />,
    );
    expect(screen.getByText('Local clock for the event.')).toBeInTheDocument();
  });

  it('shows the error instead of the hint and sets aria-invalid', () => {
    render(
      <TimePicker
        label="Start time"
        name="start"
        value=""
        onChange={() => {}}
        hint="Local clock"
        error="Pick a valid time"
      />,
    );
    expect(screen.queryByText('Local clock')).not.toBeInTheDocument();
    const error = screen.getByText('Pick a valid time');
    expect(error).toBeInTheDocument();
    expect(error).toHaveAttribute('role', 'alert');
    const input = screen.getByLabelText('Start time');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-destructive');
  });

  it('forwards the disabled prop and styles the input as muted', () => {
    render(
      <TimePicker label="Start time" name="start" value="09:00" onChange={() => {}} disabled />,
    );
    const input = screen.getByLabelText('Start time');
    expect(input).toBeDisabled();
    expect(input.className).toContain('disabled:bg-muted');
  });

  it('forwards a custom step to the underlying input', () => {
    render(
      <TimePicker label="Start time" name="start" value="09:00" onChange={() => {}} step={900} />,
    );
    expect(screen.getByLabelText('Start time')).toHaveAttribute('step', '900');
  });

  it('forwards data-testid to the underlying input', () => {
    render(
      <TimePicker
        label="Start time"
        name="start"
        value=""
        onChange={() => {}}
        data-testid="start-time"
      />,
    );
    expect(screen.getByTestId('start-time')).toBe(screen.getByLabelText('Start time'));
  });
});
