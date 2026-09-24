/**
 * synctex.service.ts
 *
 * Frontend service mirroring Backend CLSI SyncTeX:
 *  - Forward Sync (Source Line -> PDF Coordinates)
 *  - Reverse Sync (PDF Click -> Source Line)
 *
 * Delegates to unified manuscriptService.synctex (`/api/v1/manuscripts/synctex`).
 */

import { manuscriptService } from './manuscript.service';
export type {
  ForwardSyncPayload,
  ForwardSyncResult,
  ReverseSyncPayload,
  ReverseSyncResult,
} from './manuscript.service';

export const synctexService = {
  forwardSync: manuscriptService.synctex.forwardSync,
  reverseSync: manuscriptService.synctex.reverseSync,
};

export const DocumentSynctexService = synctexService;
