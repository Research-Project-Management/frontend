'use client';

/**
 * useReviewSync.ts
 *
 * Single authoritative hook synchronizing TanStack review queries -> CodeMirror decorations
 * and invalidating targeted query keys on `editor:review-event`.
 */

import { useContext, useEffect } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { EditorView } from '@codemirror/view';
import { editorCommandBus, useSettingsStore } from '@/features/editor/core';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import { reviewCoordinator } from '../../coordinator/review.coordinator';
import { commentKeys, usePageComments } from './useComments';
import { suggestionKeys, usePageSuggestions } from './useSuggestions';

const EMPTY_SUGGESTIONS: never[] = [];
const EMPTY_COMMENTS: never[] = [];

export function useReviewSync(
  docId: string | null | undefined,
  view: EditorView | null,
): void {
  const contextClient = useContext(QueryClientContext);
  const effectiveClient = useSafeQueryClient();

  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const reviewMode = useSettingsStore((s) => s.reviewMode);

  const { data: suggestionsData } = usePageSuggestions(docId ?? null, undefined, effectiveClient);
  const { data: commentsData } = usePageComments(docId ?? null, undefined, effectiveClient);
  const suggestions = suggestionsData ?? EMPTY_SUGGESTIONS;
  const comments = commentsData ?? EMPTY_COMMENTS;

  useEffect(() => {
    if (!docId || !view) return;
    reviewCoordinator.syncEditorDecorations(
      view,
      suggestions,
      comments,
      trackChangesViewMode,
      Boolean(reviewMode),
      docId,
    );
  }, [docId, view, suggestions, comments, trackChangesViewMode, reviewMode]);

  useEffect(() => {
    if (!docId || !contextClient) return;

    const unsub = editorCommandBus.subscribe('editor:review-event', ({ pageId: evtDocId, event }) => {
      if (event === 'suggestion:local-recorded') return;
      if (evtDocId && evtDocId !== docId) return;

      if (event.startsWith('comment:') || event.startsWith('comments:')) {
        void contextClient.invalidateQueries({ queryKey: commentKeys.byPage(docId) });
        void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        void contextClient.invalidateQueries({ queryKey: ['pages', 'detail', docId] });
      } else if (event.startsWith('suggestion:') || event.startsWith('suggestions:')) {
        void contextClient.invalidateQueries({ queryKey: suggestionKeys.byPage(docId) });
        void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        void contextClient.invalidateQueries({ queryKey: ['pages', 'detail', docId] });
      } else if (event === 'review:status-changed') {
        void contextClient.invalidateQueries({ queryKey: ['manuscript-review-status'] });
        void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      }
    });

    return () => unsub();
  }, [docId, contextClient]);
}

export default useReviewSync;
