'use client';

/**
 * useEditorReviewSync.ts
 *
 * Reactive synchronization hook between TanStack review queries and CodeMirror 6 View.
 * Ensures Track Changes decorations, hover popovers, and gutter markers are always active
 * in CodeMirror even when the Sidebar Review Tab is unmounted or minimized.
 * Safe against missing QueryClientContext in isolated unit test environments.
 */

import { useEffect, useContext } from 'react';
import { QueryClientContext, QueryClient } from '@tanstack/react-query';
import type { EditorView } from '@codemirror/view';
import {
  usePageSuggestions,
  suggestionKeys,
  usePageComments,
  commentKeys,
  reviewCoordinator,
} from '@/features/editor/subsystems/review';
import { useSettingsStore, editorCommandBus } from '@/features/editor/core';

const fallbackClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

export function useEditorReviewSync(
  fileId: string | null | undefined,
  view: EditorView | null
): void {
  const contextClient = useContext(QueryClientContext);
  const effectiveClient = contextClient || fallbackClient;

  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const reviewMode = useSettingsStore((s) => s.reviewMode);

  const { data: suggestions = [] } = usePageSuggestions(fileId ?? null, undefined, effectiveClient);
  const { data: comments = [] } = usePageComments(fileId ?? null, undefined, effectiveClient);

  // Synchronize decorations whenever suggestions, comments, or settings change
  useEffect(() => {
    if (!fileId || !view) return;
    reviewCoordinator.syncEditorDecorations(
      view,
      suggestions,
      comments,
      trackChangesViewMode,
      Boolean(reviewMode)
    );
  }, [fileId, view, suggestions, comments, trackChangesViewMode, reviewMode]);

  // Listen to cross-system review events (accept, reject, create) to invalidate query cache
  useEffect(() => {
    if (!fileId || !contextClient) return;

    const unsub = editorCommandBus.subscribe('editor:review-event', (event) => {
      if (event.pageId === fileId || !event.pageId) {
        contextClient.invalidateQueries({ queryKey: suggestionKeys.byPage(fileId) });
        contextClient.invalidateQueries({ queryKey: commentKeys.byPage(fileId) });
        contextClient.invalidateQueries({ queryKey: ['page-suggestions'] });
        contextClient.invalidateQueries({ queryKey: ['page-comments'] });
      }
    });

    return () => unsub();
  }, [fileId, contextClient]);
}

export default useEditorReviewSync;
