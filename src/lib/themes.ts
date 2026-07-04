export type ColorMode = 'light' | 'dark';

export interface ThemeConfig {
  name: string;
  id: string;
  className: (colorMode: ColorMode) => string;
}

export const themes: ThemeConfig[] = [
  {
    name: 'Default',
    id: 'default',
    className: (mode) => mode,
  },
  {
    name: 'Notion',
    id: 'notion',
    className: (mode) => `notion-${mode}`,
  },
  {
    name: 'Workspace',
    id: 'workspace',
    className: (mode) => `workspace-${mode}`,
  },
];

export const colorModes: { id: ColorMode; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export function getThemeVariants(): string[] {
  return themes.flatMap((theme) => colorModes.map((mode) => theme.className(mode.id)));
}

export function getAllThemeCombinations(): { theme: ThemeConfig; colorMode: ColorMode }[] {
  return themes.flatMap((theme) =>
    colorModes.map((mode) => ({
      theme,
      colorMode: mode.id,
    })),
  );
}
