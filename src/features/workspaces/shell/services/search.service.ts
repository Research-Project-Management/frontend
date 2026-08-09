import { apiGet } from '@/shared/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultType = 'project' | 'page' | 'file' | 'folder' | 'sticky';

export type SearchResult = {
  type: SearchResultType;
  id: string;
  name: string;
  icon?: string | null;
  projectId?: string;
  projectName?: string;
  content?: string;
  mimeType?: string;
  updatedAt?: string;
};

type SearchResponse = {
  results: SearchResult[];
};

// ── Raw fetcher ───────────────────────────────────────────────────────────────

export const searchWorkspace = (
  workspaceId: string,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> =>
  apiGet<SearchResponse>(`/api/workspace/${workspaceId}/search`, {
    params: { q: query },
    signal,
  });
