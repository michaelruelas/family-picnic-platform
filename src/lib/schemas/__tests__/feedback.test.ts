import { describe, it, expect } from 'vitest';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  feedbackSubmitSchema,
} from '../feedback';

const baseValid = {
  category: 'BUG' as const,
  message: 'The page is broken when I click submit.',
  email: '',
  name: '',
  pageUrl: '/events/123',
};

describe('feedbackSubmitSchema', () => {
  it('accepts a minimal payload', () => {
    const result = feedbackSubmitSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('accepts every documented category', () => {
    for (const category of FEEDBACK_CATEGORIES) {
      const result = feedbackSubmitSchema.safeParse({ ...baseValid, category });
      expect(result.success, category).toBe(true);
    }
  });

  it('rejects an unknown category', () => {
    const result = feedbackSubmitSchema.safeParse({ ...baseValid, category: 'FEATURE' });
    expect(result.success).toBe(false);
  });

  it(`rejects a message shorter than ${FEEDBACK_MESSAGE_MIN} chars after trim`, () => {
    const result = feedbackSubmitSchema.safeParse({ ...baseValid, message: '   hi   ' });
    expect(result.success).toBe(false);
  });

  it(`rejects a message longer than ${FEEDBACK_MESSAGE_MAX} chars`, () => {
    const result = feedbackSubmitSchema.safeParse({
      ...baseValid,
      message: 'a'.repeat(FEEDBACK_MESSAGE_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty optional email string (treated as absent)', () => {
    const result = feedbackSubmitSchema.safeParse({ ...baseValid, email: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = feedbackSubmitSchema.safeParse({ ...baseValid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid email', () => {
    const result = feedbackSubmitSchema.safeParse({ ...baseValid, email: 'me@example.com' });
    expect(result.success).toBe(true);
  });

  it('trims the message before validation', () => {
    const result = feedbackSubmitSchema.safeParse({
      ...baseValid,
      message: `   ${'a'.repeat(FEEDBACK_MESSAGE_MIN)}   `,
    });
    expect(result.success).toBe(true);
  });
});
