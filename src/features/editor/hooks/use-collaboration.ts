'use client';

/**
 * use-collaboration.ts
 *
 * Frontend hooks mirroring Backend `modules/document/collaboration/`:
 *  - useCollaborationPresence
 *  - useCollaborationStream (Real-time SSE event stream auto-invalidating React Query caches)
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collaborationService,
  type CollaborationPresence,
  type CollaborationEvent,
} from '../services/collaboration.service';
import { pageKeys } from './use-core';
import { commentKeys } from './use-comment';
import { suggestionKeys } from './use-suggestion';

export function useCollaborationPresence(pageId: string | null) {
  return useQuery<CollaborationPresence[], Error>({
    queryKey: ['document-collaboration-presence', pageId],
    queryFn: () => (pageId ? collaborationService.getPresence(pageId) : Promise.resolve([])),
    enabled: !!pageId,
    refetchInterval: 15000,
  });
}

export function useCollaborationStream(projectId: string | null, pageId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId || !pageId) return;

    const cleanup = collaborationService.createCollaborationStream(
      projectId,
      pageId,
      (event: CollaborationEvent) => {
        const type = event.type;

        if (type.startsWith('suggestion')) {
          queryClient.invalidateQueries({ queryKey: suggestionKeys.byPage(pageId) });
          if (type === 'suggestion-accepted' || type === 'suggestions-accepted-all') {
            queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
          }
        } else if (type.startsWith('comment')) {
          queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
        } else if (type === 'page-updated') {
          queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
        }
      },
      () => {
        // SSE disconnected / re-connecting
      },
    );

    return cleanup;
  }, [projectId, pageId, queryClient]);
}
