export const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'];

export const POTLUCK_CATEGORY_EMOJIS: Record<string, string> = {
  MAIN: '🍖',
  SIDE: '🥗',
  DESSERT: '🍰',
  DRINK: '🥤',
  OTHER: '📦',
};

export const POTLUCK_CATEGORY_LABELS: Record<string, string> = {
  MAIN: 'Main Dishes',
  SIDE: 'Side Dishes',
  DESSERT: 'Desserts',
  DRINK: 'Drinks',
  OTHER: 'Other Items',
};

/**
 * FPP-54: the placeholder shown in the public list, admin grid, and
 * claim modal when a slot has no name. Format: `<article> <category> (any)`.
 * Used by `slotDisplayName` to render category-only slots.
 */
export const POTLUCK_CATEGORY_INDEFINITE_ARTICLE: Record<string, string> = {
  MAIN: 'A main',
  SIDE: 'A side',
  DESSERT: 'A dessert',
  DRINK: 'A drink',
  OTHER: 'An item',
};

/**
 * FPP-54: render a slot's name with a category-based fallback. Returns
 * the slot's trimmed name when set, otherwise `<article> <category> (any)`.
 * Centralised so the public list, admin grid, and any future call site
 * stay in lockstep.
 */
export function slotDisplayName(slot: { name: string | null; category: string }): string {
  if (slot.name && slot.name.trim() !== '') return slot.name;
  return `${POTLUCK_CATEGORY_INDEFINITE_ARTICLE[slot.category] ?? 'An open slot'} (any)`;
}

export const HERO_IMAGES = {
  home: {
    url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=2400&q=80',
    alt: 'Family toasting with raised wine glasses in golden hour light',
    credit: {
      photographer: 'Alasdair Elmes',
      photographerUrl: 'https://unsplash.com/@alasdair_elmes',
      platform: 'Unsplash',
      licenseUrl: 'https://unsplash.com/license',
    },
  },
} as const;

export const DEFAULT_CURRENCY = 'usd';

export const SIGNED_IN_REDIRECT = '/events';

export const APP_VERSION = '0.1.13';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_ADULT'] as const;
export const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'] as const;

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN_ADULT';
}

