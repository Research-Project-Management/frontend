/**
 * review.types.ts
 * DTOs for review workflow, comments, suggestions, and realtime presence events.
 */

import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';

export type ReviewStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'submitted'
  | 'locked';

export interface ReviewRoundInfo {
  status: ReviewStatus;
  roundNumber?: number;
  requestedById?: string;
  requestedAt?: string;
  verdictById?: string;
  verdictAt?: string;
  notes?: string;
  deadline?: string;
}

export interface ReviewStatusResponse {
  ok: boolean;
  docId: string;
  spaceId?: string | null;
  projectId: string;
  review: ReviewRoundInfo;
}

export interface CreateSuggestionPayload {
  pageId: string;
  type: 'insert' | 'delete';
  originalText?: string;
  suggestedText?: string;
  fromLine: number;
  fromColumn?: number;
  toLine: number;
  toColumn?: number;
  groupId?: string;
  anchorStart?: string;
  anchorEnd?: string;
  baseDocRev?: number;
  description?: string;
  spaceId?: string | null;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  silent?: boolean;
}

export interface CollaborationPresence {
  id?: string;
  userId?: string;
  socketId?: string;
  name: string;
  avatar?: string | null;
  role?: string;
  color?: string;
  cursor?: {
    line: number;
    column: number;
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
  lastHeartbeat?: number;
  lastActiveAt?: number;
}

export interface ProjectReviewFileOverviewDto {
  docId: string;
  fileId: string;
  title: string;
  path: string;
  isRootDoc?: boolean;
  comments: PageComment[];
  suggestions: PageSuggestion[];
  counts: {
    openCommentsCount: number;
    resolvedCommentsCount: number;
    pendingSuggestionsCount: number;
    acceptedSuggestionsCount: number;
    rejectedSuggestionsCount: number;
    totalVisibleCount: number;
    totalResolvedCount: number;
  };
}

export interface ProjectReviewOverviewResponseDto {
  spaceId?: string | null;
  projectId: string;
  files: ProjectReviewFileOverviewDto[];
  totals: {
    openCommentsCount: number;
    resolvedCommentsCount: number;
    pendingSuggestionsCount: number;
    acceptedSuggestionsCount: number;
    rejectedSuggestionsCount: number;
    totalVisibleCount: number;
    totalResolvedCount: number;
  };
}
