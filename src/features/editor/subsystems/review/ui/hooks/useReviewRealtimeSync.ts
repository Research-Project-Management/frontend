'use client';

/**
 * useReviewRealtimeSync.ts
 *
 * Subscribes to editor review command-bus events and keeps comment, suggestion,
 * and manuscript review status React Query caches synchronized in real time.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { editorCommandBus } from '@/features/editor/core';

export interface UseReviewRealtimeSyncOptions {
  pageId?: string;
}

export function useReviewRealtimeSync({ pageId }: UseReviewRealtimeSyncOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pageId) return;

    const handleEvent = (event: string) => {
      if (event.startsWith('comment:') || event.startsWith('comments:')) {
        queryClient.invalidateQueries({ queryKey: ['page-comments', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-comments'] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      }
      if (event.startsWith('suggestion:') || event.startsWith('suggestions:')) {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      }
      if (event === 'review:status-changed') {
        queryClient.invalidateQueries({ queryKey: ['manuscript-review-status'] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      }
    };

    const unsub = editorCommandBus.subscribe('editor:review-event', ({ pageId: evtPageId, event }) => {
      if (evtPageId !== pageId) return;
      handleEvent(event);
    });

    return () => unsub();
  }, [pageId, queryClient]);
}
