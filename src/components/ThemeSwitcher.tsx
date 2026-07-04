'use client';

import { useTheme } from 'next-themes';
import { useMounted } from '~/hooks/useMounted';
import { themes, colorModes, type ThemeConfig, type ColorMode } from '~/lib/themes';

type SystemColorMode = ColorMode | 'system';

function findCurrentTheme(theme: string | undefined): ThemeConfig {
  if (theme?.includes('workspace')) {
    return themes.find((t) => t.id === 'workspace')!;
  }
  if (theme?.includes('notion')) {
    return themes.find((t) => t.id === 'notion')!;
  }
  return themes.find((t) => t.id === 'default')!;
}

function getCurrentColorMode(resolvedTheme: string | undefined): ColorMode {
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

export default function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-muted h-9 w-36 animate-pulse rounded-md" />
        <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      </div>
    );
  }

  const currentTheme = findCurrentTheme(theme);
  const currentColorMode = getCurrentColorMode(resolvedTheme);

  const handleThemeChange = (newTheme: ThemeConfig) => {
    setTheme(newTheme.className(currentColorMode));
  };

  const handleColorModeChange = (newMode: SystemColorMode) => {
    if (newMode === 'system') {
      setTheme(currentTheme.className('light'));
    } else {
      setTheme(currentTheme.className(newMode));
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted flex items-center gap-1 rounded-lg p-1">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => handleThemeChange(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTheme.id === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="bg-muted flex items-center gap-1 rounded-lg p-1">
        {colorModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleColorModeChange(mode.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode.id === currentColorMode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode.name}
          </button>
        ))}
      </div>
    </div>
  );
}
