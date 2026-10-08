/**
 * collaboration.api.ts
 *
 * Real-time presence, heartbeat, and Server-Sent Events (SSE) synchronization sub-API.
 */

import { apiGet, apiPost, getAuthToken, getEffectiveBaseUrl } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { CollaborationPresence, CollaborationEvent } from './types';

export const collaboration = {
  getPresence: async (docId: string): Promise<CollaborationPresence[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ activeUsers?: CollaborationPresence[]; presence?: CollaborationPresence[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/presence`,
        { silent: true },
      );
      return res.activeUsers || res.presence || [];
    } catch {
      return [];
    }
  },

  sendHeartbeat: async (
    docId: string,
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
    if (!docId) return;
    try {
      await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/heartbeat`, { cursor }, { silent: true });
    } catch {
      // ignore
    }
  },

  leaveRoom: async (docId: string): Promise<void> => {
    if (!docId) return;
    try {
      await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/leave`, {}, { silent: true });
    } catch {
      // ignore
    }
  },

  createCollaborationStream: (
    projectId: string | null | undefined,
    docId: string,
    onEvent: (event: CollaborationEvent) => void,
    onError?: (err: any) => void,
  ): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const path = projectId
      ? `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/collaboration/stream`
      : `${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/stream`;
    const baseUrl = getEffectiveBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}${path}${tokenQuery}`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed as CollaborationEvent);
      } catch {
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
