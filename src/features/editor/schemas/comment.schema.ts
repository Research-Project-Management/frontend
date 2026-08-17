/**
 * comment.schema.ts
 *
 * Zod Schemas and inferred TypeScript types for LaTeX document review & comments.
 */

import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment is too long'),
  line: z.number().int().positive().nullable().optional(),
  lineEnd: z.number().int().positive().nullable().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const createReplySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply is too long'),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;
