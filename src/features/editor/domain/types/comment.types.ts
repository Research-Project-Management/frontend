/**
 * comment.types.ts
 *
 * Types and validation schemas for inline document comments and discussion threads.
 * Matches backend document/comment module.
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
export type AddReplyInput = CreateReplyInput;

export type CommentStatus = 'open' | 'resolved';

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface CommentReply {
  id: string;
  author: CommentAuthor;
  content: string;
  createdAt: string;
}

export interface PageComment {
  id: string;
  page: string;
  projectPageId: string;
  author: CommentAuthor;
  content: string;
  line: number | null;
  lineEnd?: number | null;
  status: CommentStatus;
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
}

export type Comment = PageComment;
export type DocumentComment = PageComment;
