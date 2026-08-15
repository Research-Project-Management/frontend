import { apiGet } from '@/shared/lib/api';
import type { ReferenceData } from '../types/reference.types';

export type { ReferenceData };

export async function fetchReferenceByDoi(doi: string): Promise<{ work: ReferenceData }> {
  return apiGet<{ work: ReferenceData }>(`/api/library/reference/crossref/doi/${encodeURIComponent(doi)}`);
}

export async function searchReferences(query: string, rows = 1): Promise<{ works: ReferenceData[]; totalResults: number }> {
  return apiGet<{ works: ReferenceData[]; totalResults: number }>(
    `/api/library/reference/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`
  );
}
