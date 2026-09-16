'use client';

/**
 * use-outline.ts
 *
 * Frontend hooks mirroring Backend `modules/document/outline/`:
 *  - useDocumentOutline
 */

import { useQuery } from '@tanstack/react-query';
import { outlineService, type DocumentOutlineResponse } from '../services/outline.service';

export const outlineKeys = {
  byPage: (pageId: string | null) => ['document-outline', pageId] as const,
};

export function useDocumentOutline(pageId: string | null) {
  return useQuery<DocumentOutlineResponse, Error>({
    queryKey: outlineKeys.byPage(pageId),
    queryFn: () => (pageId ? outlineService.getDocumentOutline(pageId) : Promise.resolve({ entries: [], tree: [], totalHeadings: 0 })),
    enabled: !!pageId,
    staleTime: 10000,
  });
}
