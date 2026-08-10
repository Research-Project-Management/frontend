import { apiGet } from '@/shared/lib/api';

import type { SearchResponse } from '../types/search.types';

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
