/**
 * suggestion.schema.ts
 *
 * Zod validation schemas for Track Changes and collaborative editing suggestions.
 * Matches backend document/suggestion module DTOs.
 */

import { z } from 'zod';

export const suggestionTypeSchema = z.enum(['insert', 'delete', 'replace']);
export const suggestionStatusSchema = z.enum(['pending', 'accepted', 'rejected']);

export const createSuggestionSchema = z.object({
  type: suggestionTypeSchema,
  originalText: z.string().optional(),
  suggestedText: z.string().optional(),
  fromLine: z.number().int().min(1, 'From line must be >= 1'),
  fromColumn: z.number().int().min(1).default(1).optional(),
  toLine: z.number().int().min(1, 'To line must be >= 1'),
  toColumn: z.number().int().min(1).default(1).optional(),
  description: z.string().max(1000).optional(),
  pageId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;

export const resolveSuggestionSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export type ResolveSuggestionInput = z.infer<typeof resolveSuggestionSchema>;
