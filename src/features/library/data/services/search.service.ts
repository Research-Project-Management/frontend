import { apiGet } from "@/shared/lib/api";
import type { SearchResponse } from "../../types";
import { isProjectScope } from './items.service';

export interface SearchItemsParams {
  query: string;
  limit?: number;
  cursor?: string;
  collectionId?: string;
  tagId?: string;
}

export interface PageAnchorMatch {
  pageIndex: number;
  text: string;
  startOffset?: number;
  endOffset?: number;
  highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Search items in library with faceted queries.
 * Backed by GET /api/v1/library/search or GET /api/v1/projects/:projectId/library/search
 */
export async function searchLibrary(
  params: SearchItemsParams,
  scopeId?: string,
): Promise<SearchResponse> {
  const queryParams: Record<string, string> = {
    query: params.query,
  };
  if (params.limit !== undefined) queryParams.limit = String(params.limit);
  if (params.cursor) queryParams.cursor = params.cursor;
  if (params.collectionId) queryParams.collectionId = params.collectionId;
  if (params.tagId) queryParams.tagId = params.tagId;
  if (isProjectScope(scopeId)) queryParams.projectId = scopeId!;

  const basePath = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/search`
    : `/api/v1/library/search`;

  return apiGet<SearchResponse>(basePath, {
    params: queryParams,
  });
}

/**
 * Search PDF attachment pages for anchor/text occurrences.
 * Backed by GET /api/v1/library/search/attachments/:attachmentId/anchors
 */
export async function searchAttachmentAnchors(
  attachmentId: string,
  term: string,
  pageIndex?: number,
  scopeId?: string,
): Promise<PageAnchorMatch[]> {
  const params: Record<string, string> = { term };
  if (pageIndex !== undefined) params.pageIndex = String(pageIndex);
  if (isProjectScope(scopeId)) params.projectId = scopeId!;

  const basePath = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/search/attachments/${encodeURIComponent(attachmentId)}/anchors`
    : `/api/v1/library/search/attachments/${encodeURIComponent(attachmentId)}/anchors`;

  return apiGet<PageAnchorMatch[]>(basePath, { params });
}

export const SearchService = {
  search: searchLibrary,
  searchItems: searchLibrary,
  searchAnchors: searchAttachmentAnchors,
  searchPageAnchors: searchAttachmentAnchors,
};
