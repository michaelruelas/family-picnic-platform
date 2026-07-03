'use client';

import { useTheme } from 'next-themes';
import { useMounted } from '~/hooks/useMounted';

type Theme = 'default' | 'notion' | 'workspace';
type ColorMode = 'light' | 'dark' | 'system';

const themes: { value: Theme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'notion', label: 'Notion' },
  { value: 'workspace', label: 'Workspace' },
];

const colorModes: { value: ColorMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  const currentTheme = theme?.includes('workspace')
    ? 'workspace'
    : theme?.includes('notion')
      ? 'notion'
      : 'default';
  const currentColorMode = resolvedTheme === 'dark' ? 'dark' : 'light';

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme === 'workspace') {
      setTheme(`workspace-${currentColorMode}`);
    } else if (newTheme === 'notion') {
      setTheme(`notion-${currentColorMode}`);
    } else {
      setTheme(currentColorMode);
    }
  };

  const handleColorModeChange = (newMode: ColorMode) => {
    if (currentTheme === 'workspace') {
      setTheme(`workspace-${newMode}`);
    } else if (currentTheme === 'notion') {
      setTheme(`notion-${newMode}`);
    } else {
      setTheme(newMode);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => handleThemeChange(t.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTheme === t.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {colorModes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => handleColorModeChange(mode.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              (mode.value === 'system' && !resolvedTheme) ||
              (mode.value === 'dark' && resolvedTheme === 'dark') ||
              (mode.value === 'light' && resolvedTheme === 'light')
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
