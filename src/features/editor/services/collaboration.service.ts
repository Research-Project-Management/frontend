/**
 * collaboration.service.ts
 *
 * Frontend service mirroring Backend `modules/document/collaboration/`:
 *  - Real-time SSE Collaboration Stream (`/api/projects/:projectId/pages/:pageId/collaboration/stream`)
 *  - Presence & Active Collaborators
 *  - Heartbeat & Cursor Position
 */

import { apiGet, apiPost, getAuthToken } from '@/shared/lib/api';

export interface CollaborationPresence {
  id?: string;
  userId?: string;
  name: string;
  avatar?: string | null;
  role?: string;
  color?: string;
  cursor?: {
    line: number;
    column: number;
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
  lastHeartbeat?: number;
  lastActiveAt?: number;
}

export interface CollaborationEvent {
  pageId: string;
  type: string;
  suggestion?: any;
  comment?: any;
  user?: CollaborationPresence;
  userId?: string;
  isLocked?: boolean;
  lockedBy?: string;
  timestamp: number;
}

export const collaborationService = {
  getPresence: async (pageId: string): Promise<CollaborationPresence[]> => {
    const res = await apiGet<{ activeUsers?: CollaborationPresence[]; presence?: CollaborationPresence[] }>(
      `/api/pages/${pageId}/collaboration/presence`,
    );
    return res.activeUsers || res.presence || [];
  },

  sendHeartbeat: async (
    pageId: string,
    cursor?: {
      line: number;
      column: number;
      selection?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
    },
  ): Promise<void> => {
    await apiPost(`/api/pages/${pageId}/collaboration/heartbeat`, { cursor });
  },

  leaveRoom: async (pageId: string): Promise<void> => {
    try {
      await apiPost(`/api/pages/${pageId}/collaboration/leave`, {});
    } catch {
      // ignore
    }
  },

  createCollaborationStream: (
    projectId: string,
    pageId: string,
    onEvent: (event: CollaborationEvent) => void,
    onError?: (err: any) => void,
  ): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `/api/projects/${projectId}/pages/${pageId}/collaboration/stream${tokenQuery}`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed as CollaborationEvent);
      } catch (err) {
        // non-json message, ignore
      }
    };

    if (onError) {
      eventSource.onerror = (err) => onError(err);
    }

    return () => {
      eventSource.close();
    };
  },
};

export const DocumentCollaborationService = collaborationService;
