import { z } from 'zod';

export const FEEDBACK_CATEGORIES = ['BUG', 'SUGGESTION', 'QUESTION', 'OTHER'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: 'Something is broken',
  SUGGESTION: 'I have a suggestion',
  QUESTION: 'I have a question',
  OTHER: 'Something else',
};

// Bounds picked to keep a single submission well under any reasonable
// email body limit while still leaving room for a thorough bug report.
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;

export const feedbackSubmitSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(FEEDBACK_MESSAGE_MIN, `Please write at least ${FEEDBACK_MESSAGE_MIN} characters`)
    .max(FEEDBACK_MESSAGE_MAX, `Please keep feedback under ${FEEDBACK_MESSAGE_MAX} characters`),
  // Optional contact info. The submit procedure requires `email` when
  // the caller is not signed in so we can follow up.
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(254, 'Email is too long')
    .optional()
    .or(z.literal('')),
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name')
    .max(120, 'Name is too long')
    .optional()
    .or(z.literal('')),
  // The path the user was on when they submitted. Helps reproduce bugs.
  pageUrl: z.string().trim().max(2048, 'pageUrl is too long').optional().or(z.literal('')),
});

export type FeedbackSubmitInput = z.infer<typeof feedbackSubmitSchema>;
