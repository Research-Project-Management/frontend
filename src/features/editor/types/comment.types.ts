/**
 * comment.types.ts
 *
 * Types for inline document comments and discussion threads.
 * Matches backend document/comment module.
 */

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

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  CreateCommentInput,
  UpdateCommentInput,
  CreateReplyInput,
  CreateReplyInput as AddReplyInput,
} from '../schemas/comment.schema';
