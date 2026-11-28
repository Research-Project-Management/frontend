'use client';

import { useEffect, useMemo, useState } from 'react';
import { editorCommandBus } from '@/features/editor/core';
import { reviewCoordinator } from '../coordinator/review.coordinator';
import { usePageComments } from './useComments';
import { usePageSuggestions } from './useSuggestions';

export interface ReviewPendingCountResult {
  pendingSuggestionsCount: number;
  openCommentsCount: number;
  totalPendingCount: number;
}

const EMPTY_SUGGESTIONS: never[] = [];
const EMPTY_COMMENTS: never[] = [];

export function useReviewPendingCount(docId?: string | null): ReviewPendingCountResult {
  const { data: suggestionsData } = usePageSuggestions(docId ?? null);
  const { data: commentsData } = usePageComments(docId ?? null);
  const suggestions = suggestionsData ?? EMPTY_SUGGESTIONS;
  const comments = commentsData ?? EMPTY_COMMENTS;
  const [localRev, setLocalRev] = useState(0);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      if (!cmd.pageId || !docId || cmd.pageId === docId) {
        setLocalRev((r) => r + 1);
      }
    });
    return () => unsub();
  }, [docId]);

  const pendingSuggestionsCount = useMemo(() => {
    void localRev;
    const serverPending = Array.isArray(suggestions)
      ? suggestions.filter((s) => s.status === 'pending')
      : [];
    const localPending = reviewCoordinator
      .getLocalSuggestions(docId)
      .filter((s) => s.status === 'pending');
    const seen = new Set(serverPending.map((s) => s.id));
    let count = serverPending.length;
    for (const ls of localPending) {
      if (!seen.has(ls.id)) count++;
    }
    return count;
  }, [suggestions, docId, localRev]);

  const openCommentsCount = useMemo(
    () => (Array.isArray(comments) ? comments.filter((c) => c.status === 'open').length : 0),
    [comments],
  );

  return {
    pendingSuggestionsCount,
    openCommentsCount,
    totalPendingCount: pendingSuggestionsCount + openCommentsCount,
  };
}

export default useReviewPendingCount;
