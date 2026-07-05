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
