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

export interface CreateCommentInput {
  content: string;
  line?: number | null;
  lineEnd?: number | null;
  status?: CommentStatus;
  projectId?: string;
  pageId?: string;
}

export interface UpdateCommentInput {
  content?: string;
  status?: CommentStatus;
  projectId?: string;
}

export interface AddReplyInput {
  content: string;
  projectId?: string;
}
