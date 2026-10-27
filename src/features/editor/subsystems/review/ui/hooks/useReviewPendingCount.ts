'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePageSuggestions } from './useSuggestion';
import { usePageComments } from './useComment';
import { editorCommandBus } from '@/features/editor/core';
import { reviewCoordinator } from '@/features/editor/subsystems/review/coordinator/review.coordinator';

export interface ReviewPendingCountResult {
  pendingSuggestionsCount: number;
  openCommentsCount: number;
  totalPendingCount: number;
}

const EMPTY_SUGGESTIONS: never[] = [];
const EMPTY_COMMENTS: never[] = [];

/**
 * Hook to retrieve real-time count of pending suggestions and open comments
 * for a specific page/document. Used by Topbar and ActivityBar review badges.
 */
export function useReviewPendingCount(pageId?: string | null): ReviewPendingCountResult {
  const { data: suggestionsData } = usePageSuggestions(pageId ?? null);
  const { data: commentsData } = usePageComments(pageId ?? null);
  const suggestions = suggestionsData ?? EMPTY_SUGGESTIONS;
  const comments = commentsData ?? EMPTY_COMMENTS;
  const [localRev, setLocalRev] = useState(0);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      if (!cmd.pageId || !pageId || cmd.pageId === pageId) {
        setLocalRev((r) => r + 1);
      }
    });
    return () => unsub();
  }, [pageId]);

  const pendingSuggestionsCount = useMemo(() => {
    void localRev;
    const serverPending = Array.isArray(suggestions)
      ? suggestions.filter((s) => s.status === 'pending')
      : [];
    const localPending = reviewCoordinator
      .getLocalSuggestions(pageId)
      .filter((s) => s.status === 'pending');
    const seen = new Set(serverPending.map((s) => s.id));
    let count = serverPending.length;
    for (const ls of localPending) {
      if (!seen.has(ls.id)) count++;
    }
    return count;
  }, [suggestions, pageId, localRev]);

  const openCommentsCount = useMemo(
    () => (Array.isArray(comments) ? comments.filter((c) => c.status === 'open').length : 0),
    [comments]
  );

  return {
    pendingSuggestionsCount,
    openCommentsCount,
    totalPendingCount: pendingSuggestionsCount + openCommentsCount,
  };
}

export default useReviewPendingCount;
