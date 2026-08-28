import { apiGet } from '@/shared/lib/api';
import type { SearchResult } from '../types/search.types';

export const searchWorkspace = async (
  workspaceId: string,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> => {
  const res = await apiGet<SearchResult[] | { results: SearchResult[] }>(
    `/api/workspace/${workspaceId}/search`,
    {
      params: { q: query },
      signal,
    },
  );
  if (Array.isArray(res)) return res;
  return (res as any)?.results || [];
};


