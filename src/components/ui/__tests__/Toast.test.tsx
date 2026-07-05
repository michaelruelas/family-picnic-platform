import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { ToastProvider, useToast, Toast } from '../Toast';

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <div>Child</div>
      </ToastProvider>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});

describe('useToast', () => {
  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within a ToastProvider',
    );
  });

  it('returns addToast and removeToast functions within provider', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    expect(result.current).toHaveProperty('addToast');
    expect(result.current).toHaveProperty('removeToast');
    expect(typeof result.current.addToast).toBe('function');
    expect(typeof result.current.removeToast).toBe('function');
  });

  it('addToast adds a toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.addToast('success', 'Operation completed');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe('Operation completed');
    expect(result.current.toasts[0]!.type).toBe('success');
  });

  it('removeToast removes a toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.addToast('error', 'Something went wrong');
    });

    const toastId = result.current.toasts[0]!.id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('addToast stores custom duration', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.addToast('warning', 'Be careful', 10000);
    });

    expect(result.current.toasts[0]!.duration).toBe(10000);
  });
});

describe('Toast component', () => {
  it('auto-adds toast via addToast', () => {
    const addToast = vi.fn();
    const removeToast = vi.fn();
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    render(<Toast type="info" message="Auto toast" />, { wrapper: TestWrapper });

    const alerts = document.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]).toHaveTextContent('Auto toast');
  });
});

describe('ToastContainer', () => {
  it('renders toasts in correct position', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.addToast('success', 'Saved!');
    });

    render(
      <ToastProvider>
        <span>App content</span>
      </ToastProvider>,
    );

    const toastElements = document.querySelectorAll('[role="alert"]');
    expect(toastElements.length).toBeGreaterThanOrEqual(1);
    expect(toastElements[0]?.parentElement?.className).toContain('fixed right-4 bottom-4');
  });
});
