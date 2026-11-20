import type { EditorView } from '@codemirror/view';
import { programmaticSyncAnnotation } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  isLocalSuggestionId,
  resolveSuggestionRange,
  setCommentsEffect,
  setReviewModeEffect,
  setSuggestionsEffect,
  setViewModeEffect,
  type TrackChangesViewMode,
} from '../extensions/state';

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

export function mutateSuggestion(
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

export function syncViewToCache(
  view: EditorView,
  targetDocId: string | null | undefined,
): void {
  if (targetDocId && lruDocumentCache.getModel(targetDocId)) {
    const nextText = view.state.doc.toString();
    lruDocumentCache.updateContent(targetDocId, nextText, true);
    sessionCoordinator.notifyContentChange(targetDocId, nextText);
  }
}

export function revertMemento(
  snap: SuggestionMemento,
  activeDocId: string | null,
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

  syncViewToCache(view, sug.pageId || activeDocId);
}

export function captureSnapshot(
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

export function restoreSnapshot(snapshot: ReviewRollbackSnapshot): void {
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

export function syncServerDoc(
  docId: string,
  res: unknown,
  targetViews: EditorView[],
): void {
  if (!docId || !res || typeof res !== 'object') return;
  const payload = res as {
    page?: { rev?: number; content?: unknown };
    rev?: number;
    content?: unknown;
  };
  const serverRev = payload.page?.rev ?? payload.rev;
  if (typeof serverRev === 'number') {
    lruDocumentCache.setServerRev(docId, serverRev);
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
  if (typeof serverText === 'string' && !sessionCoordinator.isRealtimeConnected(docId)) {
    for (const view of targetViews) {
      const currentText = view.state.doc.toString();
      if (currentText !== serverText) {
        view.dispatch({
          changes: { from: 0, to: currentText.length, insert: serverText },
          annotations: programmaticSyncAnnotation.of(true),
        });
      }
    }
    if (lruDocumentCache.getModel(docId)) {
      lruDocumentCache.updateContent(docId, serverText, false);
      lruDocumentCache.markClean(docId);
    }
  }
}

export function syncDecorations(params: {
  targetDocId: string | null;
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
    targetDocId,
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
    const matchesTarget = !targetDocId || !s.pageId || s.pageId === targetDocId;
    if (matchesTarget) {
      if (isLocalSuggestionId(s.id)) {
        preservedLocal.push(s);
      }
      currentSuggestions.delete(id);
    }
  }

  const scopedSuggestions: PageSuggestion[] = [];
  for (const s of suggestions) {
    if (!targetDocId || !s.pageId || s.pageId === targetDocId) {
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

  const mergedSuggestions = targetDocId
    ? scopedSuggestions
    : Array.from(currentSuggestions.values());

  for (const [id, c] of Array.from(currentComments.entries())) {
    const commentDocId = c.page || c.projectPageId;
    if (!targetDocId || !commentDocId || commentDocId === targetDocId) {
      currentComments.delete(id);
    }
  }
  const scopedComments: PageComment[] = [];
  for (const c of comments) {
    const commentDocId = c.page || c.projectPageId;
    if (!targetDocId || !commentDocId || commentDocId === targetDocId) {
      currentComments.set(c.id, c);
      scopedComments.push(c);
    }
  }

  for (const targetView of targetViews) {
    try {
      targetView.dispatch({
        effects: [
          setSuggestionsEffect.of(mergedSuggestions),
          setCommentsEffect.of(scopedComments),
          setViewModeEffect.of(viewMode),
          setReviewModeEffect.of(reviewMode),
        ],
      });
    } catch (err) {
      console.debug('[ReviewCoordinator] Failed to sync decorations:', err);
    }
  }
}
