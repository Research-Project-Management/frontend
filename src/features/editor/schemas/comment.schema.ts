/**
 * comment.schema.ts
 *
 * Zod validation schemas for inline LaTeX document comments and replies.
 * Matches backend document/comment module DTOs.
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
  status: z.enum(['open', 'resolved']).optional(),
  projectId: z.string().optional(),
  pageId: z.string().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(['open', 'resolved']).optional(),
  projectId: z.string().optional(),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const createReplySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply is too long'),
  projectId: z.string().optional(),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;
