import { z } from 'zod';

export const VALID_REACTIONS = ['❤️', '👍', '👏', '🎉', '😂'] as const;

export const photoReactionSchema = z.object({
  photoId: z.string().min(1, 'Photo ID is required'),
  reaction: z.enum(VALID_REACTIONS),
});

export type PhotoReactionInput = z.infer<typeof photoReactionSchema>;
