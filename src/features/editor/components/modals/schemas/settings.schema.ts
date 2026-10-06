import { z } from 'zod';

export const learnedWordSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, 'Word cannot be empty')
    .max(64, 'Word is too long')
    .regex(/^[\p{L}\p{N}_\-']+$/u, 'Invalid word characters'),
});

export type LearnedWordFormValues = z.infer<typeof learnedWordSchema>;
