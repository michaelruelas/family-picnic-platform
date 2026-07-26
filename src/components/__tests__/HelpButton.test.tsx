import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { default: HelpButton } = await import('../HelpButton');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HelpButton', () => {
  it('renders the help trigger button', () => {
    render(<HelpButton />);
    expect(screen.getByLabelText('Open help')).toBeInTheDocument();
  });

  it('opens the help dialog when trigger is clicked', () => {
    render(<HelpButton />);
    fireEvent.click(screen.getByLabelText('Open help'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the default events help content', () => {
    render(<HelpButton />);
    fireEvent.click(screen.getByLabelText('Open help'));
    expect(screen.getByText('Events Help')).toBeInTheDocument();
  });

  it('closes the dialog when close button is clicked', () => {
    render(<HelpButton />);
    fireEvent.click(screen.getByLabelText('Open help'));
    fireEvent.click(screen.getByLabelText('Close help'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders all help context buttons', () => {
    render(<HelpButton />);
    fireEvent.click(screen.getByLabelText('Open help'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('events');
    expect(dialog.textContent).toContain('potluck');
    expect(dialog.textContent).toContain('photos');
    expect(dialog.textContent).toContain('profile');
    expect(dialog.textContent).toContain('household');
    expect(dialog.textContent).toContain('rsvp');
  });

  it('switches context when a context button is clicked', () => {
    render(<HelpButton />);
    fireEvent.click(screen.getByLabelText('Open help'));
    fireEvent.click(screen.getByText('potluck'));
    expect(screen.getByText('Potluck Help')).toBeInTheDocument();
  });

  it('uses custom context prop', () => {
    render(<HelpButton context="potluck" />);
    fireEvent.click(screen.getByLabelText('Open help'));
    expect(screen.getByText('Potluck Help')).toBeInTheDocument();
  });

  it('uses default help when context is not in HELP_CONTENT', () => {
    render(<HelpButton context="nonexistent" />);
    fireEvent.click(screen.getByLabelText('Open help'));
    expect(screen.getByText('Help')).toBeInTheDocument();
  });
});
