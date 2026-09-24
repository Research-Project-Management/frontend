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
  getSuggestions: manuscriptService.suggestions.getSuggestions,
  createSuggestion: manuscriptService.suggestions.createSuggestion,
  acceptSuggestion: manuscriptService.suggestions.acceptSuggestion,
  rejectSuggestion: manuscriptService.suggestions.rejectSuggestion,
  acceptAllSuggestions: manuscriptService.suggestions.acceptAllSuggestions,
  rejectAllSuggestions: manuscriptService.suggestions.rejectAllSuggestions,
};

export const DocumentSuggestionService = suggestionService;
