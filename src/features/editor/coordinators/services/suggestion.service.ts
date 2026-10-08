/**
 * suggestion.service.ts
 *
 * Frontend service mirroring Backend Manuscript Track Changes / Review:
 *  - Track changes / Suggestions (pending, accepted, rejected)
 *  - Accept, Reject, Accept-All, Reject-All
 *
 * Delegates to unified manuscriptService.suggestions (`/api/v1/manuscripts/docs/:docId/suggestions`).
 */

import { manuscriptService } from './manuscript.service';
export type { CreateSuggestionPayload } from './manuscript.service';

export const suggestionService = {
  getSuggestions: (docId: string, status?: any) =>
    manuscriptService.suggestions.getSuggestions(docId, status),
  createSuggestion: (payload: any) => manuscriptService.suggestions.createSuggestion(payload),
  acceptSuggestion: (docId: string, suggestionId: string) =>
    manuscriptService.suggestions.acceptSuggestion(docId, suggestionId),
  rejectSuggestion: (docId: string, suggestionId: string) =>
    manuscriptService.suggestions.rejectSuggestion(docId, suggestionId),
  acceptAllSuggestions: (docId: string) =>
    manuscriptService.suggestions.acceptAllSuggestions(docId),
  rejectAllSuggestions: (docId: string) =>
    manuscriptService.suggestions.rejectAllSuggestions(docId),
};

export const DocumentSuggestionService = suggestionService;
