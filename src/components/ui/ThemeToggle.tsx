'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useMounted } from '~/hooks/useMounted';

type ThemeChoice = 'light' | 'dark' | 'system';

const options: { value: ThemeChoice; label: string; description: string; icon: string }[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Sun-drenched and easy on the eyes during the day.',
    icon: '☀️',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'A warm evening glow, easy on the eyes at night.',
    icon: '🌙',
  },
  {
    value: 'system',
    label: 'Match my device',
    description: 'Follow your system setting. Switches automatically.',
    icon: '⚙️',
  },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemPrefersDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="shimmer h-20 w-full rounded-3xl" />
        <div className="shimmer h-20 w-full rounded-3xl" />
        <div className="shimmer h-20 w-full rounded-3xl" />
      </div>
    );
  }

  const current = (theme as ThemeChoice) ?? 'system';

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Theme preference">
      {options.map((opt) => {
        const isActive = current === opt.value;
        const isSystemEffective =
          opt.value === 'system'
            ? resolvedTheme === (systemPrefersDark ? 'dark' : 'light')
            : opt.value === resolvedTheme;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(opt.value)}
            className={`group press flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
              isActive
                ? 'border-terracotta bg-terracotta/10 shadow-soft'
                : 'border-border bg-card hover:border-foreground/40'
            }`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-colors ${
                isActive ? 'bg-terracotta shadow-soft text-white' : 'bg-secondary text-foreground'
              }`}
              aria-hidden
            >
              {opt.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-foreground text-base font-semibold">
                  {opt.label}
                </span>
                {opt.value === 'system' && (
                  <span className="rounded-pill bg-secondary text-muted-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                    Auto
                  </span>
                )}
                {isSystemEffective && opt.value !== 'system' && (
                  <span className="rounded-pill bg-sage/20 text-sage px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">{opt.description}</p>
            </div>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                isActive ? 'border-terracotta bg-terracotta' : 'border-border bg-card'
              }`}
              aria-hidden
            >
              {isActive && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
