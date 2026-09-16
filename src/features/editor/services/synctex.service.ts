/**
 * synctex.service.ts
 *
 * Frontend service mirroring Backend `modules/document/synctex/`:
 *  - Forward Sync (Source Line -> PDF Coordinates)
 *  - Reverse Sync (PDF Click -> Source Line)
 */

import { apiPost } from '@/shared/lib/api';

export interface ForwardSyncPayload {
  projectId: string;
  file: string;
  line: number;
  column?: number;
  pdfPath?: string;
}

export interface ForwardSyncResult {
  page: number;
  x: number;
  y: number;
  h: number;
  w: number;
}

export interface ReverseSyncPayload {
  projectId: string;
  page: number;
  x: number;
  y: number;
  pdfPath?: string;
}

export interface ReverseSyncResult {
  file: string;
  line: number;
  column: number;
}

export const synctexService = {
  forwardSync: async (payload: ForwardSyncPayload): Promise<ForwardSyncResult | null> => {
    const res = await apiPost<any>('/api/synctex/forward', payload);
    if (res?.success && res?.result) {
      return {
        page: res.result.page ?? 1,
        x: res.result.x ?? 72,
        y: res.result.y ?? 72,
        w: res.result.width ?? 450,
        h: res.result.height ?? 14,
      };
    }
    return null;
  },

  reverseSync: async (payload: ReverseSyncPayload): Promise<ReverseSyncResult | null> => {
    const res = await apiPost<any>('/api/synctex/reverse', payload);
    if (res?.success && res?.result) {
      return {
        file: res.result.file ?? '',
        line: res.result.line ?? 1,
        column: res.result.column ?? 0,
      };
    }
    return null;
  },
};

export const DocumentSynctexService = synctexService;
