/**
 * suggestion.types.ts
 *
 * Types for track changes, collaborative editing proposals, and diff resolution.
 */

export type SuggestionType = 'insert' | 'delete' | 'replace';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type TrackChangesViewMode = 'changes' | 'clean' | 'original' | 'show' | 'hide';

interface SuggestionAuthor {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
}

export interface PageSuggestion {
  id: string;
  groupId?: string | null;
  pageId: string;
  projectId?: string | null;
  projectPageId?: string | null;
  authorId?: string | null;
  author: SuggestionAuthor;
  type: SuggestionType;
  originalText: string;
  suggestedText: string;
  fromLine?: number;
  fromColumn?: number;
  toLine?: number;
  toColumn?: number;
  fromIndex?: number;
  toIndex?: number;
  anchorStart?: string | null;
  anchorEnd?: string | null;
  baseDocRev?: number | null;
  description?: string | null;
  status: SuggestionStatus;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
