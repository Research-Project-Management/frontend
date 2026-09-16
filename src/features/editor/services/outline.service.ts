/**
 * outline.service.ts
 *
 * Frontend service mirroring Backend `modules/document/outline/`:
 *  - Extract Document TOC / Outline
 *  - Parse Outline on-the-fly from source
 */

import { apiGet, apiPost } from '@/shared/lib/api';

export interface OutlineEntry {
  level: number;
  title: string;
  line: number;
  type: string;
  children?: OutlineEntry[];
}

export interface DocumentOutlineResponse {
  entries: OutlineEntry[];
  tree: OutlineEntry[];
  totalHeadings: number;
}

export const outlineService = {
  getDocumentOutline: async (pageId: string): Promise<DocumentOutlineResponse> => {
    return await apiGet<DocumentOutlineResponse>(`/api/pages/${pageId}/outline`);
  },

  parseRawOutline: async (source: string): Promise<DocumentOutlineResponse> => {
    return await apiPost<DocumentOutlineResponse>('/api/compiler/outline', { source });
  },
};

export const DocumentOutlineService = outlineService;
