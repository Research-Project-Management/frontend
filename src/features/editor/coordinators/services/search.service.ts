/**
 * search.service.ts
 *
 * Frontend service for Document Search & Batch Replace:
 *  - Project-wide and page-hierarchy text search
 *  - Atomic cross-file batch replace
 *
 * Delegates to unified manuscriptService.search (`/api/v1/manuscripts/projects/:projectId/search`).
 */

import { manuscriptService } from './manuscript.service';
export type {
  SearchMatchEntry,
  FileSearchResult,
  SearchResultResponse,
  BatchReplaceResultResponse,
  SearchOptions,
  BatchReplaceOptions,
} from './manuscript.service';

export const documentSearchService = {
  search: manuscriptService.search.search,
  batchReplace: manuscriptService.search.batchReplace,
};
