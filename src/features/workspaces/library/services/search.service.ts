import { apiGet } from '@/shared/lib/api';

export interface SearchDiscoveryParams {
  q?: string;
  itemType?: string;
  collectionId?: string;
  tagId?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'relevance' | 'dateAdded' | 'year' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export const SearchService = {
  /**
   * Search catalog items with multi-field matching, full-text ranking, and faceted discovery
   */
  discoverySearch: (workspaceId: string, params: SearchDiscoveryParams) =>
    apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/discovery/search`,
      { params: params as Record<string, string | number | boolean | null | undefined> },
    ),

  /**
   * Search anchors and page matches inside a specific attachment
   */
  searchAnchors: (workspaceId: string, attachmentId: string, term: string, pageIndex?: number) =>
    apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/search/attachments/${encodeURIComponent(attachmentId)}/anchors`,
      { params: { term, ...(pageIndex !== undefined ? { pageIndex: pageIndex.toString() } : {}) } },
    ),
};

