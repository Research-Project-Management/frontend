/**
 * collaboration.service.ts
 *
 * Frontend service mirroring Backend Manuscript Collaboration:
 *  - Real-time SSE Collaboration Stream (`/api/v1/manuscripts/projects/:projectId/docs/:docId/collaboration/stream`)
 *  - Presence & Active Collaborators
 *  - Heartbeat & Cursor Position
 *
 * Delegates to unified manuscriptService.collaboration.
 */

import { manuscriptService } from './manuscript.service';
export type {
  CollaborationPresence,
  CollaborationEvent,
} from './manuscript.service';

export const collaborationService = {
  getPresence: manuscriptService.collaboration.getPresence,
  sendHeartbeat: manuscriptService.collaboration.sendHeartbeat,
  leaveRoom: manuscriptService.collaboration.leaveRoom,
  createCollaborationStream: manuscriptService.collaboration.createCollaborationStream,
};

export const DocumentCollaborationService = collaborationService;
