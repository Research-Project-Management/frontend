'use client';

import { useMemo } from 'react';
import { usePageSuggestions } from '@/features/editor/ui/hooks/use-suggestion';
import { usePageComments } from '@/features/editor/ui/hooks/use-comment';

export interface ReviewPendingCountResult {
  pendingSuggestionsCount: number;
  openCommentsCount: number;
  totalPendingCount: number;
}

/**
 * Hook to retrieve real-time count of pending suggestions and open comments
 * for a specific page/document. Used by Topbar and ActivityBar review badges.
 */
export function useReviewPendingCount(pageId?: string | null): ReviewPendingCountResult {
  const { data: suggestions = [] } = usePageSuggestions(pageId ?? null);
  const { data: comments = [] } = usePageComments(pageId ?? null);

  const pendingSuggestionsCount = useMemo(
    () => (Array.isArray(suggestions) ? suggestions.filter((s) => s.status === 'pending').length : 0),
    [suggestions]
  );

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
