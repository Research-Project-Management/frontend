'use client';

/**
 * useReviewRealtimeNotifications.ts
 *
 * Dedicated hook for handling real-time review events (comments, suggestions, mentions, digests).
 * Encapsulates toast notifications for mentions and digests, adhering to the architecture rule
 * that components never directly import or invoke toast.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

export interface UseReviewRealtimeNotificationsOptions {
  pageId?: string;
  userId?: string;
}

export function useReviewRealtimeNotifications({
  pageId,
  userId,
}: UseReviewRealtimeNotificationsOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pageId) return;

    const handleEvent = (event: string, payload: any) => {
      if (event.startsWith('comment:') || event.startsWith('comments:')) {
        queryClient.invalidateQueries({ queryKey: ['page-comments', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-comments'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      }
      if (event.startsWith('suggestion:') || event.startsWith('suggestions:')) {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      }
      if (event === 'notification:digest') {
        queryClient.invalidateQueries({ queryKey: ['notification-bundler'] });
        const digest = payload?.digest;
        if (digest && userId === payload?.recipientId) {
          toast.info('Review digest received', {
            description: digest.summary,
          });
        }
      }
      if (event === 'comment:mention') {
        const mentionedIds = payload?.mentionedUserIds || [];
        if (userId && mentionedIds.includes(userId)) {
          toast.info('You were mentioned in a review discussion!', {
            description: payload?.content
              ? payload.content.slice(0, 120)
              : 'A collaborator tagged you in a comment.',
          });
        }
      }
    };

    const unsub = editorCommandBus.subscribe('editor:review-event', ({ pageId: evtPageId, event, payload }) => {
      if (evtPageId !== pageId) return;
      handleEvent(event, payload);
    });

    return () => unsub();
  }, [pageId, queryClient, userId]);
}
