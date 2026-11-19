/**
 * suggestion-buffer-mutator.ts
 *
 * Pure CodeMirror buffer mutation, rollback snapshot capture/restore,
 * and server-patched document resynchronization helpers for ReviewCoordinator.
 */

import { type EditorView } from '@codemirror/view';
import { programmaticSyncAnnotation } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import {
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  resolveSuggestionRange,
  type TrackChangesViewMode,
} from '@/features/editor/subsystems/review/extensions/track-changes-state';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';

export interface SuggestionMemento {
  readonly view: EditorView;
  readonly range: { from: number; to: number };
  readonly postMutationTo: number;
  readonly originalText: string;
  readonly sug: PageSuggestion;
}

export interface ReviewRollbackSnapshot {
  readonly pageId: string | null;
  readonly viewDocs: Array<{ view: EditorView; text: string }>;
  readonly suggestions: Array<[string, PageSuggestion]>;
}

export function mutateSuggestionInView(
  view: EditorView,
  sug: PageSuggestion,
  action: 'accept' | 'reject',
): SuggestionMemento {
  const doc = view.state.doc;
  const { from, to } = resolveSuggestionRange(doc, sug);
  const currentSlice = from < to && to <= doc.length ? doc.sliceString(from, to) : '';
  let postMutationTo = to;

  if (action === 'accept') {
    if (sug.type === 'delete') {
      if (from < to && to <= doc.length) {
        view.dispatch({
          changes: { from, to, insert: '' },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from;
      }
    } else if (sug.type === 'replace' && sug.suggestedText !== undefined) {
      if (from < to && to <= doc.length && currentSlice !== sug.suggestedText) {
        view.dispatch({
          changes: { from, to, insert: sug.suggestedText },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from + sug.suggestedText.length;
      }
    } else if (sug.type === 'insert' && sug.suggestedText) {
      if (from <= to && to <= doc.length && currentSlice !== sug.suggestedText) {
        view.dispatch({
          changes: { from, to: from, insert: sug.suggestedText },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from + sug.suggestedText.length;
      }
    }
  } else {
    if (sug.type === 'insert') {
      if (from < to && to <= doc.length && (!sug.suggestedText || currentSlice === sug.suggestedText)) {
        view.dispatch({
          changes: { from, to, insert: '' },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from;
      }
    } else if (sug.type === 'replace' && sug.originalText !== undefined) {
      if (from < to && to <= doc.length && currentSlice !== sug.originalText) {
        view.dispatch({
          changes: { from, to, insert: sug.originalText },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from + sug.originalText.length;
      }
    } else if (sug.type === 'delete' && sug.originalText) {
      if (from === to && from <= doc.length) {
        view.dispatch({
          changes: { from, to: from, insert: sug.originalText },
          annotations: programmaticSyncAnnotation.of(true),
        });
        postMutationTo = from + sug.originalText.length;
      }
    }
  }

  return {
    view,
    range: { from, to },
    postMutationTo,
    originalText: currentSlice,
    sug: { ...sug },
  };
}

export function syncMutatedViewToCache(
  view: EditorView,
  targetPageId: string | null | undefined,
): void {
  if (targetPageId && lruDocumentCache.getModel(targetPageId)) {
    const nextText = view.state.doc.toString();
    lruDocumentCache.updateContent(targetPageId, nextText, true);
    sessionCoordinator.notifyContentChange(targetPageId, nextText);
  }
}

export function revertMementoInView(
  snap: SuggestionMemento,
  activePageId: string | null,
): void {
  const { view, sug, range, postMutationTo, originalText } = snap;
  const currentLen = view.state.doc.length;
  const safeFrom = Math.min(range.from, currentLen);
  const safeTo = Math.min(postMutationTo, currentLen);

  if (originalText !== undefined && (safeFrom !== safeTo || originalText.length > 0)) {
    view.dispatch({
      changes: { from: safeFrom, to: safeTo, insert: originalText },
      annotations: programmaticSyncAnnotation.of(true),
    });
  }

  syncMutatedViewToCache(view, sug.pageId || activePageId);
}

export function captureRollbackSnapshotForViews(
  pageId: string | null,
  targetViews: EditorView[],
  currentSuggestions: Map<string, PageSuggestion>,
): ReviewRollbackSnapshot {
  return {
    pageId,
    viewDocs: targetViews.map((view) => ({
      view,
      text: view.state.doc.toString(),
    })),
    suggestions: Array.from(currentSuggestions.entries()).map(([id, sug]) => [
      id,
      { ...sug },
    ]),
  };
}

export function applySnapshotToBuffers(snapshot: ReviewRollbackSnapshot): void {
  for (const { view, text } of snapshot.viewDocs) {
    const currentText = view.state.doc.toString();
    if (currentText !== text) {
      view.dispatch({
        changes: { from: 0, to: currentText.length, insert: text },
        annotations: programmaticSyncAnnotation.of(true),
      });
    }
  }

  if (snapshot.pageId && snapshot.viewDocs.length > 0 && lruDocumentCache.getModel(snapshot.pageId)) {
    const restoredText = snapshot.viewDocs[0].text;
    lruDocumentCache.updateContent(snapshot.pageId, restoredText, true);
    sessionCoordinator.notifyContentChange(snapshot.pageId, restoredText);
  }
}

export function syncServerPatchedDocumentToViews(
  pageId: string,
  res: unknown,
  targetViews: EditorView[],
): void {
  if (!pageId || !res || typeof res !== 'object') return;
  const payload = res as {
    page?: { rev?: number; content?: unknown };
    rev?: number;
    content?: unknown;
  };
  const serverRev = payload.page?.rev ?? payload.rev;
  if (typeof serverRev === 'number') {
    lruDocumentCache.setServerRev(pageId, serverRev);
  }
  const rawContent = payload.page?.content ?? payload.content;
  const serverText =
    typeof rawContent === 'string'
      ? rawContent
      : rawContent && typeof rawContent === 'object'
        ? String(
            (rawContent as Record<string, unknown>).text ??
              (rawContent as Record<string, unknown>).content ??
              '',
          )
        : null;
  if (typeof serverText === 'string' && !sessionCoordinator.isRealtimeConnected(pageId)) {
    for (const view of targetViews) {
      const currentText = view.state.doc.toString();
      if (currentText !== serverText) {
        view.dispatch({
          changes: { from: 0, to: currentText.length, insert: serverText },
          annotations: programmaticSyncAnnotation.of(true),
        });
      }
    }
    if (lruDocumentCache.getModel(pageId)) {
      lruDocumentCache.updateContent(pageId, serverText, false);
      lruDocumentCache.markClean(pageId);
    }
  }
}

export function reconcileAndDispatchReviewDecorations(params: {
  targetPageId: string | null;
  suggestions: PageSuggestion[];
  comments: PageComment[];
  viewMode: TrackChangesViewMode;
  reviewMode: boolean;
  currentSuggestions: Map<string, PageSuggestion>;
  currentComments: Map<string, PageComment>;
  localToPersistedId: Map<string, string>;
  targetViews: EditorView[];
}): void {
  const {
    targetPageId,
    suggestions,
    comments,
    viewMode,
    reviewMode,
    currentSuggestions,
    currentComments,
    localToPersistedId,
    targetViews,
  } = params;

  const preservedLocal: PageSuggestion[] = [];
  for (const [id, s] of Array.from(currentSuggestions.entries())) {
    const matchesTarget = !targetPageId || !s.pageId || s.pageId === targetPageId;
    if (matchesTarget) {
      if (s.id.startsWith('sug-local-')) {
        preservedLocal.push(s);
      }
      currentSuggestions.delete(id);
    }
  }

  const scopedSuggestions: PageSuggestion[] = [];
  for (const s of suggestions) {
    if (!targetPageId || !s.pageId || s.pageId === targetPageId) {
      currentSuggestions.set(s.id, s);
      scopedSuggestions.push(s);
    }
  }
  for (const localSug of preservedLocal) {
    const persistedId = localToPersistedId.get(localSug.id);
    if (persistedId && currentSuggestions.has(persistedId)) continue;
    if (!currentSuggestions.has(localSug.id)) {
      currentSuggestions.set(localSug.id, localSug);
      scopedSuggestions.push(localSug);
    }
  }

  const mergedSuggestions = targetPageId
    ? scopedSuggestions
    : Array.from(currentSuggestions.values());

  for (const [id, c] of Array.from(currentComments.entries())) {
    const commentPageId = c.page || c.projectPageId;
    if (!targetPageId || !commentPageId || commentPageId === targetPageId) {
      currentComments.delete(id);
    }
  }
  const scopedComments: PageComment[] = [];
  for (const c of comments) {
    const commentPageId = c.page || c.projectPageId;
    if (!targetPageId || !commentPageId || commentPageId === targetPageId) {
      currentComments.set(c.id, c);
      scopedComments.push(c);
    }
  }

  for (const targetView of targetViews) {
    try {
      targetView.dispatch({
        effects: [
          setTrackChangesSuggestionsEffect.of(mergedSuggestions),
          setTrackChangesCommentsEffect.of(scopedComments),
          setTrackChangesViewModeEffect.of(viewMode),
          setTrackChangesReviewModeEffect.of(reviewMode),
        ],
      });
    } catch (err) {
      console.debug('[ReviewCoordinator] Failed to sync decorations:', err);
    }
  }
}
