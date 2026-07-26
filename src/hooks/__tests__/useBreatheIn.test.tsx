import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, screen } from '@testing-library/react';
import { useBreatheIn } from '../useBreatheIn';

interface MockObserverInstance {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  callback: IntersectionObserverCallback;
}

let mockObserverInstances: MockObserverInstance[] = [];

function Wrapper({ children }: { children: React.ReactNode }) {
  const [ref] = useBreatheIn<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="observed">
      {children}
    </div>
  );
}

let MockCtor: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockObserverInstances = [];
  const ctorImpl = function (this: unknown, callback: IntersectionObserverCallback) {
    const instance: MockObserverInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      callback,
    };
    mockObserverInstances.push(instance);
    return instance;
  } as unknown as ReturnType<typeof vi.fn>;
  MockCtor = vi.fn(ctorImpl as never) as unknown as ReturnType<typeof vi.fn>;
  // Make the spy callable with `new` by ensuring its implementation returns the instance
  (MockCtor as unknown as { mockImplementation: (fn: unknown) => unknown }).mockImplementation(
    ctorImpl as never,
  );
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockCtor;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBreatheIn (standalone hook)', () => {
  it('returns a ref and initial isVisible=false', () => {
    const { result } = renderHook(() => useBreatheIn<HTMLDivElement>());
    expect(result.current[0]).toBeDefined();
    expect(result.current[0].current).toBeNull();
    expect(result.current[1]).toBe(false);
  });

  it('returns a non-null ref object', () => {
    const { result } = renderHook(() => useBreatheIn<HTMLDivElement>());
    expect(result.current[0]).toHaveProperty('current');
  });
});

describe('useBreatheIn (with DOM attachment)', () => {
  it('instantiates IntersectionObserver when ref is attached to a DOM node', () => {
    render(<Wrapper>content</Wrapper>);
    expect(mockObserverInstances).toHaveLength(1);
    expect(mockObserverInstances[0]!.observe).toHaveBeenCalled();
  });

  it('flips isVisible to true when intersection entry is intersecting', () => {
    render(<Wrapper>content</Wrapper>);
    const section = screen.getByTestId('observed');
    expect(section.className).not.toContain('is-visible');
    const instance = mockObserverInstances[0]!;
    act(() => {
      instance.callback(
        [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
        instance as unknown as IntersectionObserver,
      );
    });
    expect(instance.disconnect).toHaveBeenCalled();
  });

  it('does not flip to visible on non-intersecting entries', () => {
    render(<Wrapper>content</Wrapper>);
    const instance = mockObserverInstances[0]!;
    act(() => {
      instance.callback(
        [{ isIntersecting: false } as unknown as IntersectionObserverEntry],
        instance as unknown as IntersectionObserver,
      );
    });
    expect(instance.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects observer on unmount', () => {
    const { unmount } = render(<Wrapper>content</Wrapper>);
    const instance = mockObserverInstances[0]!;
    unmount();
    expect(instance.disconnect).toHaveBeenCalled();
  });

  it('uses rootMargin and threshold options on IntersectionObserver', () => {
    render(<Wrapper>content</Wrapper>);
    const ctor = (globalThis as unknown as { IntersectionObserver: unknown })
      .IntersectionObserver as unknown as ReturnType<typeof vi.fn>;
    expect(ctor).toHaveBeenCalledTimes(1);
    const opts = ctor.mock.calls[0]?.[1];
    expect(opts).toEqual({ rootMargin: '0px 0px -50px 0px', threshold: 0.1 });
  });
});

describe('useBreatheIn (no IntersectionObserver available)', () => {
  it('falls back to visible when IntersectionObserver is missing', async () => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    function Fallback() {
      const [ref, isVisible] = useBreatheIn<HTMLDivElement>();
      return <div ref={ref} data-isvisible={String(isVisible)} />;
    }
    render(<Fallback />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const div = document.querySelector('[data-isvisible]') as HTMLElement | null;
    expect(div?.getAttribute('data-isvisible')).toBe('true');
  });
});
