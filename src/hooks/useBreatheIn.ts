'use client';

import { useEffect, useRef, useState, RefObject } from 'react';

export function useBreatheIn<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = ref.current;
    if (!node) return;

    if (!('IntersectionObserver' in window)) {
      // Defer to avoid set-state-in-effect lint
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '0px 0px -50px 0px', threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref as RefObject<T>, isVisible];
}
