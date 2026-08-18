'use client';

import { useState, useRef, useEffect } from 'react';
import { THEMES, ThemePreset, getStoredTheme, applyTheme } from '~/lib/theme';
import { useMounted } from '~/hooks/useMounted';

export function ThemeSelector() {
  const mounted = useMounted();
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => getStoredTheme());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Initialize from localStorage once mounted on client
  useEffect(() => {
    if (!mounted) return;
    const stored = getStoredTheme();
    applyTheme(stored);
  }, [mounted]);

  // Handle click outside and escape key
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (preset: ThemePreset) => {
    setCurrentTheme(preset);
    applyTheme(preset);
    setIsOpen(false);
  };

  const currentThemeDef = THEMES[currentTheme] || THEMES['alpine-lake'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Theme palette: ${currentThemeDef.name}`}
        title={`Current palette: ${currentThemeDef.name}. Click to change theme.`}
        className="border-border bg-card text-foreground hover:bg-secondary hover:border-foreground/40 press flex h-10 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-all"
      >
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-full shadow-sm"
            style={{ backgroundColor: currentThemeDef.swatches[0] }}
          />
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: currentThemeDef.swatches[1] }}
          />
        </span>
        <span className="hidden text-xs font-semibold sm:inline">{currentThemeDef.name}</span>
        <svg
          className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Theme presets"
          className="border-border bg-card shadow-pop animate-fade-in absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-sm border p-2 backdrop-blur-lg"
        >
          <div className="border-border/60 border-b px-3 py-2">
            <p className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Palette Presets
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Live preview color configurations
            </p>
          </div>

          <div className="mt-1.5 space-y-1">
            {(Object.keys(THEMES) as ThemePreset[]).map((key) => {
              const theme = THEMES[key];
              const isSelected = currentTheme === key;

              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={`group flex w-full items-start gap-3 rounded-sm p-2.5 text-left transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary/30 border'
                      : 'hover:bg-secondary border border-transparent'
                  }`}
                >
                  <div className="mt-0.5 flex shrink-0 items-center gap-1">
                    {theme.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="inline-block h-3.5 w-3.5 rounded-full shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {theme.name}
                      </p>
                      {isSelected && (
                        <span className="text-primary text-xs font-bold">✓ Active</span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                      {theme.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
