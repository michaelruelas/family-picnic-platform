import { describe, it, expect } from 'vitest';

describe('constants', () => {
  describe('VALID_REACTIONS', () => {
    it('has exactly 5 emojis', async () => {
      const { VALID_REACTIONS } = await import('../constants');
      expect(VALID_REACTIONS).toHaveLength(5);
    });

    it('contains expected emojis', async () => {
      const { VALID_REACTIONS } = await import('../constants');
      expect(VALID_REACTIONS).toEqual(['❤️', '👍', '👏', '🎉', '😂']);
    });

    it('contains only string values', async () => {
      const { VALID_REACTIONS } = await import('../constants');
      VALID_REACTIONS.forEach((reaction) => {
        expect(typeof reaction).toBe('string');
      });
    });
  });

  describe('POTLUCK_CATEGORY_EMOJIS', () => {
    it('has exactly 5 category keys', async () => {
      const { POTLUCK_CATEGORY_EMOJIS } = await import('../constants');
      expect(Object.keys(POTLUCK_CATEGORY_EMOJIS)).toHaveLength(5);
    });

    it('has MAIN, SIDE, DESSERT, DRINK, OTHER keys', async () => {
      const { POTLUCK_CATEGORY_EMOJIS } = await import('../constants');
      expect(POTLUCK_CATEGORY_EMOJIS).toHaveProperty('MAIN');
      expect(POTLUCK_CATEGORY_EMOJIS).toHaveProperty('SIDE');
      expect(POTLUCK_CATEGORY_EMOJIS).toHaveProperty('DESSERT');
      expect(POTLUCK_CATEGORY_EMOJIS).toHaveProperty('DRINK');
      expect(POTLUCK_CATEGORY_EMOJIS).toHaveProperty('OTHER');
    });

    it('maps each category to the correct emoji', async () => {
      const { POTLUCK_CATEGORY_EMOJIS } = await import('../constants');
      expect(POTLUCK_CATEGORY_EMOJIS.MAIN).toBe('🍖');
      expect(POTLUCK_CATEGORY_EMOJIS.SIDE).toBe('🥗');
      expect(POTLUCK_CATEGORY_EMOJIS.DESSERT).toBe('🍰');
      expect(POTLUCK_CATEGORY_EMOJIS.DRINK).toBe('🥤');
      expect(POTLUCK_CATEGORY_EMOJIS.OTHER).toBe('📦');
    });
  });

  describe('POTLUCK_CATEGORY_LABELS', () => {
    it('has exactly 5 category keys', async () => {
      const { POTLUCK_CATEGORY_LABELS } = await import('../constants');
      expect(Object.keys(POTLUCK_CATEGORY_LABELS)).toHaveLength(5);
    });

    it('has MAIN, SIDE, DESSERT, DRINK, OTHER keys', async () => {
      const { POTLUCK_CATEGORY_LABELS } = await import('../constants');
      expect(POTLUCK_CATEGORY_LABELS).toHaveProperty('MAIN');
      expect(POTLUCK_CATEGORY_LABELS).toHaveProperty('SIDE');
      expect(POTLUCK_CATEGORY_LABELS).toHaveProperty('DESSERT');
      expect(POTLUCK_CATEGORY_LABELS).toHaveProperty('DRINK');
      expect(POTLUCK_CATEGORY_LABELS).toHaveProperty('OTHER');
    });

    it('maps each category to the correct readable label', async () => {
      const { POTLUCK_CATEGORY_LABELS } = await import('../constants');
      expect(POTLUCK_CATEGORY_LABELS.MAIN).toBe('Main Dishes');
      expect(POTLUCK_CATEGORY_LABELS.SIDE).toBe('Side Dishes');
      expect(POTLUCK_CATEGORY_LABELS.DESSERT).toBe('Desserts');
      expect(POTLUCK_CATEGORY_LABELS.DRINK).toBe('Drinks');
      expect(POTLUCK_CATEGORY_LABELS.OTHER).toBe('Other Items');
    });
  });
});
