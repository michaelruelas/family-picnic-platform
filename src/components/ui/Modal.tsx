'use client';

import { useEffect, useRef, useCallback, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'bottom-sheet';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
    },
    [onClose],
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
            : 'shadow-pop animate-breathe-in rounded-2xl'
        } bg-card p-7 pt-9 pb-10 ${className} `}
        {...props}
      >
        {isBottomSheet && (
          <div className="bg-muted absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full md:hidden" />
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
          className="text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-5 right-5 rounded-full p-1.5 transition-colors"
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
        <div className={`${title ? 'mt-4' : ''}`}>{children}</div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
