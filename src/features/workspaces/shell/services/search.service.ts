import { apiGet } from '@/shared/lib/api';

import type { SearchResponse } from '../types/search.types';

export const searchWorkspace = (
  workspaceId: string,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> =>
  apiGet<SearchResponse>(`/api/search/workspaces/${workspaceId}`, {
    params: { q: query },
    signal,
  });

