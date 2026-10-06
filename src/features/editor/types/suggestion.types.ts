/**
 * suggestion.types.ts
 *
 * Types for track changes, collaborative editing proposals, and diff resolution.
 * Matches backend document/suggestion module.
 */

export type SuggestionType = 'insert' | 'delete' | 'replace';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface SuggestionAuthor {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface PageSuggestion {
  id: string;
  pageId: string;
  projectPageId?: string | null;
  authorId: string;
  author: SuggestionAuthor;
  type: SuggestionType;
  originalText: string;
  suggestedText: string;
  fromLine: number;
  fromColumn: number;
  toLine: number;
  toColumn: number;
  description?: string | null;
  status: SuggestionStatus;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  CreateSuggestionInput,
  ResolveSuggestionInput,
} from '../schemas/suggestion.schema';
