import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return { ...actual, createPortal: (node: React.ReactNode) => node };
});

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Title">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Child Content</p>
      </Modal>,
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('calls onClose when clicking overlay/backdrop', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has close button with aria-label "Close modal"', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render title when not provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('Modal focus trap', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupFocusTrap() {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Modal>,
    );
    // DOM order: Close button (rendered first inside modal), then children wrapper with First, Second, Third
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return {
      focusable,
      firstFocusable: focusable[0],
      lastFocusable: focusable[focusable.length - 1],
    };
  }

  it('wraps focus from last to first on Tab when on last element', () => {
    const { lastFocusable, firstFocusable } = setupFocusTrap();
    lastFocusable!.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(firstFocusable);
  });

  it('wraps focus from first to last on Shift+Tab when on first element', () => {
    const { firstFocusable, lastFocusable } = setupFocusTrap();
    firstFocusable!.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastFocusable);
  });

  it('does not wrap when Tab pressed on a middle element', () => {
    const { focusable } = setupFocusTrap();
    const middle = focusable[1]!;
    middle.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(middle);
  });
});

describe('Modal variants', () => {
  const onClose = vi.fn();
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders bottom-sheet variant', () => {
    render(
      <Modal isOpen={true} onClose={onClose} variant="bottom-sheet">
        <p>Sheet</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders different size variants', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={onClose} size="sm">
        <p>SM</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={onClose} size="lg">
        <p>LG</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={onClose} size="xl">
        <p>XL</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
