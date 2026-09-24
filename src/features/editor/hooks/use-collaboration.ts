'use client';

/**
 * use-collaboration.ts
 *
 * Clean decoupled collaboration hooks for Editor UI.
 * Pure UI presentation state without legacy SSE or polling loops.
 */

import { type CollaborationPresence } from '../services/collaboration.service';

export function useCollaborationPresence(_pageId: string | null) {
  return {
    data: [] as CollaborationPresence[],
    isLoading: false,
    error: null,
  };
}

export function useCollaborationStream(_projectId?: string | null, _pageId?: string | null) {
  // Pure UI shell - no-op to eliminate legacy EventSource network errors
}
