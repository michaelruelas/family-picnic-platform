import { describe, it, expect } from 'vitest';

describe('themes', () => {
  describe('themes array', () => {
    it('has exactly 3 theme entries', async () => {
      const { themes } = await import('../themes');
      expect(themes).toHaveLength(3);
    });

    it('has default, notion, and workspace themes', async () => {
      const { themes } = await import('../themes');
      const ids = themes.map((t) => t.id);
      expect(ids).toContain('default');
      expect(ids).toContain('notion');
      expect(ids).toContain('workspace');
    });

    it('each theme has name, id, and className function', async () => {
      const { themes } = await import('../themes');
      themes.forEach((theme) => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('id');
        expect(typeof theme.className).toBe('function');
      });
    });

    it('default theme className returns just the mode', async () => {
      const { themes } = await import('../themes');
      const defaultTheme = themes.find((t) => t.id === 'default');
      expect(defaultTheme!.className('light')).toBe('light');
      expect(defaultTheme!.className('dark')).toBe('dark');
    });

    it('notion theme className returns notion-{mode}', async () => {
      const { themes } = await import('../themes');
      const notionTheme = themes.find((t) => t.id === 'notion');
      expect(notionTheme!.className('light')).toBe('notion-light');
      expect(notionTheme!.className('dark')).toBe('notion-dark');
    });

    it('workspace theme className returns workspace-{mode}', async () => {
      const { themes } = await import('../themes');
      const workspaceTheme = themes.find((t) => t.id === 'workspace');
      expect(workspaceTheme!.className('light')).toBe('workspace-light');
      expect(workspaceTheme!.className('dark')).toBe('workspace-dark');
    });
  });

  describe('colorModes', () => {
    it('has exactly 2 modes', async () => {
      const { colorModes } = await import('../themes');
      expect(colorModes).toHaveLength(2);
    });

    it('has light and dark modes', async () => {
      const { colorModes } = await import('../themes');
      expect(colorModes).toContainEqual({ id: 'light', name: 'Light' });
      expect(colorModes).toContainEqual({ id: 'dark', name: 'Dark' });
    });

    it('each entry has id and name properties', async () => {
      const { colorModes } = await import('../themes');
      colorModes.forEach((mode) => {
        expect(mode).toHaveProperty('id');
        expect(mode).toHaveProperty('name');
        expect(typeof mode.id).toBe('string');
        expect(typeof mode.name).toBe('string');
      });
    });
  });

  describe('getThemeVariants', () => {
    it('returns 6 variants (3 themes x 2 modes)', async () => {
      const { getThemeVariants } = await import('../themes');
      const variants = getThemeVariants();
      expect(variants).toHaveLength(6);
    });

    it('includes all expected className values', async () => {
      const { getThemeVariants } = await import('../themes');
      const variants = getThemeVariants();
      expect(variants).toContain('light');
      expect(variants).toContain('dark');
      expect(variants).toContain('notion-light');
      expect(variants).toContain('notion-dark');
      expect(variants).toContain('workspace-light');
      expect(variants).toContain('workspace-dark');
    });
  });

  describe('getAllThemeCombinations', () => {
    it('returns 6 pairs (3 themes x 2 modes)', async () => {
      const { getAllThemeCombinations } = await import('../themes');
      const combinations = getAllThemeCombinations();
      expect(combinations).toHaveLength(6);
    });

    it('each combination has theme and colorMode properties', async () => {
      const { getAllThemeCombinations } = await import('../themes');
      const combinations = getAllThemeCombinations();
      combinations.forEach((combo) => {
        expect(combo).toHaveProperty('theme');
        expect(combo).toHaveProperty('colorMode');
        expect(combo.theme).toHaveProperty('id');
        expect(combo.theme).toHaveProperty('name');
        expect(['light', 'dark']).toContain(combo.colorMode);
      });
    });

    it('covers all theme and colorMode combinations', async () => {
      const { getAllThemeCombinations, themes, colorModes } = await import('../themes');
      const combinations = getAllThemeCombinations();
      for (const theme of themes) {
        for (const mode of colorModes) {
          expect(combinations).toContainEqual({
            theme,
            colorMode: mode.id,
          });
        }
      }
    });
  });
});
