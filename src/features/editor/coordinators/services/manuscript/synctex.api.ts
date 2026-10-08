/**
 * synctex.api.ts
 *
 * SyncTeX sub-API: Forward and reverse SyncTeX coordinate synchronization.
 */

import { apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type {
  ForwardSyncPayload,
  ForwardSyncResult,
  ReverseSyncPayload,
  ReverseSyncResult,
} from './types';

export const synctex = {
  forwardSync: async (payload: ForwardSyncPayload): Promise<ForwardSyncResult | null> => {
    const res = await apiPost<any>(`${MANUSCRIPTS_API_BASE}/synctex/forward`, payload);
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
    const res = await apiPost<any>(`${MANUSCRIPTS_API_BASE}/synctex/reverse`, payload);
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
