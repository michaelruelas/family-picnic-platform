'use client';

import { useEffect, useRef, useCallback, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'bottom-sheet';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  // FPP-115: the RSVP bottom sheet grows to fit 3-4 household
  // members and the potluck list on wide displays. `2xl` widens the
  // sheet while the caller still constrains it to the viewport.
  '2xl': 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  variant = 'default',
  className = '',
  children,
  ...props
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Keep the latest onClose in a ref so the keydown handler has a
  // stable identity across renders. If the handler were recreated on
  // every render (because callers pass inline arrow functions), the
  // focus effect below would re-run on every keystroke: its cleanup
  // refocuses `previousActiveElement` and its setup refocuses the
  // first focusable element, yanking focus out of whatever input the
  // user is typing in.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCloseRef.current();
      return;
    }

    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  // FPP-118: mobile bottom sheets should also dismiss when the user
  // taps the scrim above the sheet, not only when they hit the X. The
  // backdrop already wires onClick to onClose (line 111), but a touch
  // that begins inside the scrolling content can otherwise prevent the
  // backdrop from receiving the gesture. Tracking here ensures
  // touchend always invokes onClose, while keeping click behavior
  // unchanged for mouse users.
  const touchStartRef = useRef<{ y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { y: touch.clientY };
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const end = e.changedTouches[0]?.clientY ?? start.y;
      // Swipe-down threshold (≥96px) so a tap on a sticky tab or
      // checkbox does not accidentally close the sheet. Only bottom
      // sheets opt into the swipe; centered modals ignore it so
      // dragging inside their content does not dismiss them.
      if (variant === 'bottom-sheet' && end - start.y >= 96) {
        onCloseRef.current();
      }
    },
    [variant],
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isBottomSheet = variant === 'bottom-sheet';

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 p-4 ${
        isBottomSheet
          ? 'flex items-end justify-center md:items-center'
          : 'flex items-center justify-center'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="bg-foreground/30 animate-fade-in fixed inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} ${
          isBottomSheet
            ? 'animate-breathe-in rounded-t-[2rem] md:rounded-[2rem]'
            : 'shadow-pop animate-breathe-in rounded-sm'
        } bg-card p-7 pt-9 pb-10 ${className} `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        {...props}
      >
        {isBottomSheet && (
          <div className="bg-muted absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-sm md:hidden" />
        )}
        {title && (
          <h2
            id="modal-title"
            className="font-display text-foreground text-2xl font-semibold tracking-tight"
          >
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-5 right-5 rounded-sm p-1.5 transition-colors"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div
          // 8rem = pt-9 + pb-10 + p-7 modal chrome budget
          className={`${title ? 'mt-4' : ''} max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
