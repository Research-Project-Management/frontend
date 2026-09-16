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
  forwardSync: async (payload: ForwardSyncPayload): Promise<ForwardSyncResult> => {
    return await apiPost<ForwardSyncResult>('/api/synctex/forward', payload);
  },

  reverseSync: async (payload: ReverseSyncPayload): Promise<ReverseSyncResult> => {
    return await apiPost<ReverseSyncResult>('/api/synctex/reverse', payload);
  },
};

export const DocumentSynctexService = synctexService;
