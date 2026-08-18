/**
 * Centralized Design System & Theme Engine
 *
 * Change `ACTIVE_THEME` below to instantly switch the entire platform's color scheme.
 * All tokens (primary, success, warning, info, destructive, neutrals) are semantic and generic.
 */

export type ThemePreset =
  | 'forest-green' // Natural Forest Green (Deep Spruce, Fern Needle, Mountain Moss, Forest Mist)
  | 'alpine-lake' // Crisp Alpine Lake (Azure Sky, Pine Forest, Meadow Gold, Granite)
  | 'forest-mountain' // Evergreen Canopy (Forest Green, Emerald, Wood Gold, Moss)
  | 'sunset-trail' // Pacific Sunset & Ember (Sunset Coral/Ember, Violet Dusk, Sand Gold)
  | 'ocean-breeze' // Coastal Ocean (Teal Blue, Cyan Highlight, Sand, Marine Slate)
  | 'classic-warm'; // Original Warm Earth (Terracotta, Sage Green, Honey Sunlight)

/**
 * === ACTIVE THEME CONFIGURATION ===
 * Switch this value to try any theme preset instantly!
 */
export const ACTIVE_THEME: ThemePreset = 'forest-green';

export interface ThemeColors {
  // Brand / Interactive
  primary: string;
  primaryHover: string;
  primaryForeground: string;

  // Secondary & Accents
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;

  // Semantic Status Tones
  success: string;
  successHover: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveHover: string;
  destructiveForeground: string;

  // Neutrals / Surfaces
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;

  // Demographic / Family Tree category tokens
  roleAdult: string;
  roleChild: string;
  roleDependent: string;
}

export interface ThemeDefinition {
  name: string;
  description: string;
  swatches: [string, string, string]; // [primary, secondary/accent, accent/warmth]
  light: ThemeColors;
  dark: ThemeColors;
}

export const THEMES: Record<ThemePreset, ThemeDefinition> = {
  // 1. Natural Forest Green (All-natural forest tones: Deep Spruce, Rich Pine, Forest Moss)
  'forest-green': {
    name: 'Forest Green',
    description: 'Natural forest greens: deep pine, spruce evergreen, and woodland moss',
    swatches: ['#1b5e37', '#2d7a4d', '#637828'],
    light: {
      primary: '#1b5e37', // Deep Forest Pine
      primaryHover: '#14472a',
      primaryForeground: '#ffffff',
      secondary: '#edf4ef', // Pale forest mist
      secondaryForeground: '#1a4329',
      muted: '#e1ece4',
      mutedForeground: '#526e5e',
      accent: '#d5e7db', // Morning pine dew
      accentForeground: '#14472a',
      success: '#1b5e37', // Spruce evergreen
      successHover: '#14472a',
      successForeground: '#ffffff',
      warning: '#637828', // Natural forest moss
      warningForeground: '#ffffff',
      info: '#1f5951', // Cedar forest teal
      infoForeground: '#ffffff',
      destructive: '#dc2626',
      destructiveHover: '#b91c1c',
      destructiveForeground: '#ffffff',
      background: '#f4f7f5', // Crisp woodland mist
      foreground: '#112319', // Deep cedar bark
      card: '#ffffff',
      cardForeground: '#112319',
      border: '#cfe0d5',
      input: '#cfe0d5',
      ring: '#1b5e37',
      roleAdult: '#1b5e37',
      roleChild: '#2d7a4d',
      roleDependent: '#1f5951',
    },
    dark: {
      primary: '#2d7a4d', // Rich natural pine evergreen
      primaryHover: '#38945f',
      primaryForeground: '#ffffff',
      secondary: '#1b3226', // Woodland shadow
      secondaryForeground: '#eef5f1',
      muted: '#182e23',
      mutedForeground: '#95aea0',
      accent: '#234533',
      accentForeground: '#a3d9b8',
      success: '#2d7a4d',
      successHover: '#38945f',
      successForeground: '#ffffff',
      warning: '#708a32', // Natural moss green
      warningForeground: '#ffffff',
      info: '#2a6960', // Blue cedar spruce
      infoForeground: '#ffffff',
      destructive: '#f87171',
      destructiveHover: '#fca5a5',
      destructiveForeground: '#450a0a',
      background: '#0c1712', // Midnight forest floor
      foreground: '#eef5f1', // Birch snow
      card: '#13251c', // Deep pine surface
      cardForeground: '#eef5f1',
      border: '#284c3a', // Clear, visible border
      input: '#284c3a',
      ring: '#38945f',
      roleAdult: '#2d7a4d',
      roleChild: '#38945f',
      roleDependent: '#2a6960',
    },
  },

  // 2. Alpine Mountain Lake (Inspired by crisp mountain water & pine forests)
  'alpine-lake': {
    name: 'Alpine Lake',
    description: 'Crisp azure lake water, pine ridge greens, and granite stone',
    swatches: ['#0284c7', '#15803d', '#f59e0b'],
    light: {
      primary: '#0284c7', // Sky / Lake Azure
      primaryHover: '#0369a1',
      primaryForeground: '#ffffff',
      secondary: '#f1f5f9',
      secondaryForeground: '#0f172a',
      muted: '#e2e8f0',
      mutedForeground: '#64748b',
      accent: '#e0f2fe',
      accentForeground: '#0369a1',
      success: '#15803d', // Pine Forest Green
      successHover: '#166534',
      successForeground: '#ffffff',
      warning: '#f59e0b', // Meadow Gold / Sunlit Sand
      warningForeground: '#78350f',
      info: '#0284c7', // Lake Sky Blue
      infoForeground: '#0c4a6e',
      destructive: '#ef4444',
      destructiveHover: '#dc2626',
      destructiveForeground: '#ffffff',
      background: '#f8fafc',
      foreground: '#0f172a',
      card: '#ffffff',
      cardForeground: '#0f172a',
      border: '#e2e8f0',
      input: '#e2e8f0',
      ring: '#0284c7',
      roleAdult: '#0284c7',
      roleChild: '#0ea5e9',
      roleDependent: '#15803d',
    },
    dark: {
      primary: '#38bdf8',
      primaryHover: '#7dd3fc',
      primaryForeground: '#082f49',
      secondary: '#18263b',
      secondaryForeground: '#f1f5f9',
      muted: '#18263b',
      mutedForeground: '#94a3b8',
      accent: '#1e3a5f',
      accentForeground: '#38bdf8',
      success: '#4ade80',
      successHover: '#86efac',
      successForeground: '#052e16',
      warning: '#fbbf24',
      warningForeground: '#451a03',
      info: '#38bdf8',
      infoForeground: '#082f49',
      destructive: '#f87171',
      destructiveHover: '#fca5a5',
      destructiveForeground: '#450a0a',
      background: '#0b1320',
      foreground: '#f1f5f9',
      card: '#111c2e',
      cardForeground: '#f1f5f9',
      border: '#24354e',
      input: '#24354e',
      ring: '#38bdf8',
      roleAdult: '#38bdf8',
      roleChild: '#7dd3fc',
      roleDependent: '#4ade80',
    },
  },

  // 2. Forest Mountain (Lush evergreen canopy and deep woods)
  'forest-mountain': {
    name: 'Forest Mountain',
    description: 'Lush evergreen canopy, rich emerald, and mist neutrals',
    swatches: ['#15803d', '#4ade80', '#d97706'],
    light: {
      primary: '#15803d',
      primaryHover: '#166534',
      primaryForeground: '#ffffff',
      secondary: '#f0fdf4',
      secondaryForeground: '#14532d',
      muted: '#e2e8f0',
      mutedForeground: '#64748b',
      accent: '#dcfce7',
      accentForeground: '#15803d',
      success: '#16a34a',
      successHover: '#15803d',
      successForeground: '#ffffff',
      warning: '#d97706',
      warningForeground: '#78350f',
      info: '#0284c7',
      infoForeground: '#0c4a6e',
      destructive: '#dc2626',
      destructiveHover: '#b91c1c',
      destructiveForeground: '#ffffff',
      background: '#f7faf8',
      foreground: '#14281e',
      card: '#ffffff',
      cardForeground: '#14281e',
      border: '#dce7df',
      input: '#dce7df',
      ring: '#15803d',
      roleAdult: '#15803d',
      roleChild: '#0284c7',
      roleDependent: '#d97706',
    },
    dark: {
      primary: '#4ade80',
      primaryHover: '#86efac',
      primaryForeground: '#052e16',
      secondary: '#13281c',
      secondaryForeground: '#ecfdf5',
      muted: '#183324',
      mutedForeground: '#88a894',
      accent: '#1e402e',
      accentForeground: '#4ade80',
      success: '#4ade80',
      successHover: '#86efac',
      successForeground: '#052e16',
      warning: '#fbbf24',
      warningForeground: '#451a03',
      info: '#38bdf8',
      infoForeground: '#082f49',
      destructive: '#f87171',
      destructiveHover: '#fca5a5',
      destructiveForeground: '#450a0a',
      background: '#09150e',
      foreground: '#ecfdf5',
      card: '#102217',
      cardForeground: '#ecfdf5',
      border: '#1c3d2a',
      input: '#1c3d2a',
      ring: '#4ade80',
      roleAdult: '#4ade80',
      roleChild: '#38bdf8',
      roleDependent: '#fbbf24',
    },
  },

  // 3. Sunset Trail (Vibrant warm ember & sunset sky)
  'sunset-trail': {
    name: 'Sunset Trail',
    description: 'Campfire ember, desert trail warmth, and twilight stone',
    swatches: ['#ea580c', '#fb923c', '#f59e0b'],
    light: {
      primary: '#ea580c',
      primaryHover: '#c2410c',
      primaryForeground: '#ffffff',
      secondary: '#fff7ed',
      secondaryForeground: '#431407',
      muted: '#f5ebe6',
      mutedForeground: '#78716c',
      accent: '#ffedd5',
      accentForeground: '#9a3412',
      success: '#16a34a',
      successHover: '#15803d',
      successForeground: '#ffffff',
      warning: '#f59e0b',
      warningForeground: '#78350f',
      info: '#0284c7',
      infoForeground: '#0c4a6e',
      destructive: '#ef4444',
      destructiveHover: '#dc2626',
      destructiveForeground: '#ffffff',
      background: '#faf7f5',
      foreground: '#292524',
      card: '#ffffff',
      cardForeground: '#292524',
      border: '#ede5e0',
      input: '#ede5e0',
      ring: '#ea580c',
      roleAdult: '#ea580c',
      roleChild: '#f59e0b',
      roleDependent: '#16a34a',
    },
    dark: {
      primary: '#fb923c',
      primaryHover: '#fdba74',
      primaryForeground: '#431407',
      secondary: '#2e1810',
      secondaryForeground: '#ffedd5',
      muted: '#382016',
      mutedForeground: '#a89d96',
      accent: '#472215',
      accentForeground: '#fb923c',
      success: '#4ade80',
      successHover: '#86efac',
      successForeground: '#052e16',
      warning: '#fbbf24',
      warningForeground: '#451a03',
      info: '#38bdf8',
      infoForeground: '#082f49',
      destructive: '#f87171',
      destructiveHover: '#fca5a5',
      destructiveForeground: '#450a0a',
      background: '#140c09',
      foreground: '#fbf5f2',
      card: '#201410',
      cardForeground: '#fbf5f2',
      border: '#38251e',
      input: '#38251e',
      ring: '#fb923c',
      roleAdult: '#fb923c',
      roleChild: '#fbbf24',
      roleDependent: '#4ade80',
    },
  },

  // 4. Ocean Breeze (Coastal cyan & teal)
  'ocean-breeze': {
    name: 'Ocean Breeze',
    description: 'Pacific teal ocean, cyan sea spray, and cool coastal mist',
    swatches: ['#0891b2', '#22d3ee', '#059669'],
    light: {
      primary: '#0891b2',
      primaryHover: '#0e7490',
      primaryForeground: '#ffffff',
      secondary: '#ecfeff',
      secondaryForeground: '#164e63',
      muted: '#e2e8f0',
      mutedForeground: '#64748b',
      accent: '#cffafe',
      accentForeground: '#155e75',
      success: '#059669',
      successHover: '#047857',
      successForeground: '#ffffff',
      warning: '#f59e0b',
      warningForeground: '#78350f',
      info: '#0284c7',
      infoForeground: '#0c4a6e',
      destructive: '#ef4444',
      destructiveHover: '#dc2626',
      destructiveForeground: '#ffffff',
      background: '#f8fafc',
      foreground: '#0f172a',
      card: '#ffffff',
      cardForeground: '#0f172a',
      border: '#e2e8f0',
      input: '#e2e8f0',
      ring: '#0891b2',
      roleAdult: '#0891b2',
      roleChild: '#06b6d4',
      roleDependent: '#059669',
    },
    dark: {
      primary: '#22d3ee',
      primaryHover: '#67e8f9',
      primaryForeground: '#164e63',
      secondary: '#112933',
      secondaryForeground: '#ecfeff',
      muted: '#163644',
      mutedForeground: '#89aab8',
      accent: '#184254',
      accentForeground: '#22d3ee',
      success: '#34d399',
      successHover: '#6ee7b7',
      successForeground: '#064e3b',
      warning: '#fbbf24',
      warningForeground: '#451a03',
      info: '#38bdf8',
      infoForeground: '#082f49',
      destructive: '#f87171',
      destructiveHover: '#fca5a5',
      destructiveForeground: '#450a0a',
      background: '#08141a',
      foreground: '#f0fdfa',
      card: '#0e202a',
      cardForeground: '#f0fdfa',
      border: '#1a3746',
      input: '#1a3746',
      ring: '#22d3ee',
      roleAdult: '#22d3ee',
      roleChild: '#38bdf8',
      roleDependent: '#34d399',
    },
  },

  // 5. Classic Warm (Warm rustic terracotta, sage & cream)
  'classic-warm': {
    name: 'Classic Warm',
    description: 'Rustic terracotta, sage foliage, and warm linen neutrals',
    swatches: ['#e07a5f', '#81b29a', '#f2cc8f'],
    light: {
      primary: '#e07a5f',
      primaryHover: '#cf6c52',
      primaryForeground: '#ffffff',
      secondary: '#f3efe7',
      secondaryForeground: '#2b2d42',
      muted: '#efece5',
      mutedForeground: '#6c757d',
      accent: '#f2cc8f',
      accentForeground: '#5a4513',
      success: '#81b29a',
      successHover: '#6fa18a',
      successForeground: '#ffffff',
      warning: '#f2cc8f',
      warningForeground: '#5a4513',
      info: '#6c757d',
      infoForeground: '#2b2d42',
      destructive: '#c44536',
      destructiveHover: '#a83a2d',
      destructiveForeground: '#ffffff',
      background: '#f9f8f6',
      foreground: '#2b2d42',
      card: '#ffffff',
      cardForeground: '#2b2d42',
      border: '#ece7dc',
      input: '#ece7dc',
      ring: '#2b2d42',
      roleAdult: '#e07a5f',
      roleChild: '#f2cc8f',
      roleDependent: '#81b29a',
    },
    dark: {
      primary: '#e8907a',
      primaryHover: '#f0a896',
      primaryForeground: '#1f1812',
      secondary: '#2a2520',
      secondaryForeground: '#f3ede2',
      muted: '#2a2520',
      mutedForeground: '#9a9082',
      accent: '#3a2f1c',
      accentForeground: '#f2cc8f',
      success: '#8dbfa7',
      successHover: '#a8d2be',
      successForeground: '#1f1812',
      warning: '#d9b678',
      warningForeground: '#2a1f0e',
      info: '#9a9082',
      infoForeground: '#f3ede2',
      destructive: '#d96a5a',
      destructiveHover: '#e6887a',
      destructiveForeground: '#1f1812',
      background: '#15130f',
      foreground: '#f3ede2',
      card: '#211d18',
      cardForeground: '#f3ede2',
      border: '#3a3329',
      input: '#3a3329',
      ring: '#f3ede2',
      roleAdult: '#e8907a',
      roleChild: '#d9b678',
      roleDependent: '#8dbfa7',
    },
  },
};

export const THEME_STORAGE_KEY = 'fpp_palette_theme';

/**
 * Generates an inline script to prevent theme flash on page load
 */
export function getThemeScript(): string {
  const themeCssMap: Record<string, string> = {};
  for (const key of Object.keys(THEMES)) {
    themeCssMap[key] = getThemeCss(key as ThemePreset);
  }

  return `
    (function() {
      try {
        var themes = ${JSON.stringify(themeCssMap)};
        var saved = localStorage.getItem('${THEME_STORAGE_KEY}');
        if (saved && themes[saved]) {
          var el = document.getElementById('dynamic-theme');
          if (el) el.innerHTML = themes[saved];
        }
      } catch (e) {}
    })();
  `;
}

/**
 * Returns the currently active theme configuration
 */
export function getActiveTheme(): ThemeDefinition {
  return THEMES[ACTIVE_THEME] || THEMES['forest-green'];
}

export const activeTheme = getActiveTheme();
export const themeColors = activeTheme.light;

/**
 * Generates the dynamic CSS string for :root and .dark
 * Injected in layout.tsx so changing ACTIVE_THEME takes effect immediately.
 */
export function getThemeCss(preset: ThemePreset = ACTIVE_THEME): string {
  const theme = THEMES[preset] || THEMES['forest-green'];
  const light = theme.light;
  const dark = theme.dark;

  return `
    :root {
      --background: ${light.background};
      --foreground: ${light.foreground};
      --card: ${light.card};
      --card-foreground: ${light.cardForeground};
      --popover: ${light.card};
      --popover-foreground: ${light.cardForeground};
      --primary: ${light.primary};
      --primary-hover: ${light.primaryHover};
      --primary-foreground: ${light.primaryForeground};
      --secondary: ${light.secondary};
      --secondary-foreground: ${light.secondaryForeground};
      --muted: ${light.muted};
      --muted-foreground: ${light.mutedForeground};
      --accent: ${light.accent};
      --accent-foreground: ${light.accentForeground};
      --success: ${light.success};
      --success-hover: ${light.successHover};
      --success-foreground: ${light.successForeground};
      --warning: ${light.warning};
      --warning-foreground: ${light.warningForeground};
      --info: ${light.info};
      --info-foreground: ${light.infoForeground};
      --destructive: ${light.destructive};
      --destructive-hover: ${light.destructiveHover};
      --destructive-foreground: ${light.destructiveForeground};
      --role-adult: ${light.roleAdult};
      --role-child: ${light.roleChild};
      --role-dependent: ${light.roleDependent};
      --border: ${light.border};
      --input: ${light.input};
      --ring: ${light.ring};
      --chart-1: ${light.primary};
      --chart-2: ${light.success};
      --chart-3: ${light.warning};
      --chart-4: ${light.info};
      --chart-5: ${light.foreground};
      --sidebar: ${light.background};
      --sidebar-foreground: ${light.foreground};
      --sidebar-primary: ${light.primary};
      --sidebar-primary-foreground: ${light.primaryForeground};
      --sidebar-accent: ${light.accent};
      --sidebar-accent-foreground: ${light.accentForeground};
      --sidebar-border: ${light.border};
      --sidebar-ring: ${light.ring};
    }

    .dark {
      --background: ${dark.background};
      --foreground: ${dark.foreground};
      --card: ${dark.card};
      --card-foreground: ${dark.cardForeground};
      --popover: ${dark.card};
      --popover-foreground: ${dark.cardForeground};
      --primary: ${dark.primary};
      --primary-hover: ${dark.primaryHover};
      --primary-foreground: ${dark.primaryForeground};
      --secondary: ${dark.secondary};
      --secondary-foreground: ${dark.secondaryForeground};
      --muted: ${dark.muted};
      --muted-foreground: ${dark.mutedForeground};
      --accent: ${dark.accent};
      --accent-foreground: ${dark.accentForeground};
      --success: ${dark.success};
      --success-hover: ${dark.successHover};
      --success-foreground: ${dark.successForeground};
      --warning: ${dark.warning};
      --warning-foreground: ${dark.warningForeground};
      --info: ${dark.info};
      --info-foreground: ${dark.infoForeground};
      --destructive: ${dark.destructive};
      --destructive-hover: ${dark.destructiveHover};
      --destructive-foreground: ${dark.destructiveForeground};
      --role-adult: ${dark.roleAdult};
      --role-child: ${dark.roleChild};
      --role-dependent: ${dark.roleDependent};
      --border: ${dark.border};
      --input: ${dark.input};
      --ring: ${dark.ring};
      --chart-1: ${dark.primary};
      --chart-2: ${dark.success};
      --chart-3: ${dark.warning};
      --chart-4: ${dark.info};
      --chart-5: ${dark.foreground};
      --sidebar: ${dark.background};
      --sidebar-foreground: ${dark.foreground};
      --sidebar-primary: ${dark.primary};
      --sidebar-primary-foreground: ${dark.primaryForeground};
      --sidebar-accent: ${dark.accent};
      --sidebar-accent-foreground: ${dark.accentForeground};
      --sidebar-border: ${dark.border};
      --sidebar-ring: ${dark.ring};
    }
  `;
}

/**
 * Returns the stored theme preset from localStorage, or ACTIVE_THEME default
 */
export function getStoredTheme(): ThemePreset {
  if (typeof window === 'undefined') return ACTIVE_THEME;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEMES) {
      return stored as ThemePreset;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return ACTIVE_THEME;
}

/**
 * Dynamically applies a theme preset by updating the injected <style id="dynamic-theme">
 */
export function applyTheme(preset: ThemePreset) {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('dynamic-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = getThemeCss(preset);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preset);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
