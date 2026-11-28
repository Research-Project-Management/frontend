import type { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  isLocalSuggestionId,
  resolveSuggestionRange,
  reviewStateField,
  setSuggestionsEffect,
  type TrackChangesViewMode,
} from '../extensions/state';
import { encodeYjsAnchor } from '../extensions/anchor';
import {
  captureSnapshot,
  mutateSuggestion,
  restoreSnapshot,
  revertMemento,
  syncDecorations,
  syncServerDoc,
  syncViewToCache,
  type ReviewRollbackSnapshot,
  type SuggestionMemento,
} from './buffer';

export interface ReviewServicePort {
  acceptSuggestion(docId: string, suggestionId: string): Promise<unknown>;
  rejectSuggestion(docId: string, suggestionId: string): Promise<unknown>;
  acceptAllSuggestions(docId: string): Promise<unknown>;
  rejectAllSuggestions(docId: string): Promise<unknown>;
  acceptSelectedSuggestions(docId: string, suggestionIds: string[]): Promise<unknown>;
  rejectSelectedSuggestions(docId: string, suggestionIds: string[]): Promise<unknown>;
  batchResolve?(
    docId: string,
    payload: { suggestionIds: string[]; action: 'accept' | 'reject' },
  ): Promise<unknown>;
  createSuggestion?(payload: {
    pageId: string;
    type: 'insert' | 'delete';
    originalText: string;
    suggestedText: string;
    fromLine: number;
    fromColumn: number;
    toLine: number;
    toColumn: number;
    groupId?: string;
    anchorStart?: string;
    anchorEnd?: string;
    baseDocRev?: number;
    headers?: Record<string, string>;
    idempotencyKey?: string;
    silent?: boolean;
  }): Promise<{
    id?: string;
    pageId?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  } | null | undefined>;
}

export const defaultReviewServicePort: ReviewServicePort = {
  acceptSuggestion: (docId, suggestionId) =>
    pagesService.suggestions.acceptSuggestion(docId, suggestionId),
  rejectSuggestion: (docId, suggestionId) =>
    pagesService.suggestions.rejectSuggestion(docId, suggestionId),
  acceptAllSuggestions: (docId) =>
    pagesService.suggestions.acceptAllSuggestions(docId),
  rejectAllSuggestions: (docId) =>
    pagesService.suggestions.rejectAllSuggestions(docId),
  acceptSelectedSuggestions: (docId, suggestionIds) =>
    pagesService.suggestions.acceptSelectedSuggestions(docId, suggestionIds),
  rejectSelectedSuggestions: (docId, suggestionIds) =>
    pagesService.suggestions.rejectSelectedSuggestions(docId, suggestionIds),
  batchResolve: (docId, payload) =>
    pagesService.suggestions.batchResolve(docId, payload),
  createSuggestion: (payload) =>
    pagesService.suggestions.createSuggestion(payload),
};

export interface ReviewCoordinatorState {
  servicePort: ReviewServicePort;
  readonly viewsByFileId: Map<string, Set<EditorView>>;
  lastBoundView: EditorView | null;
  activePageId: string | null;
  currentViewMode: TrackChangesViewMode;
  currentReviewMode: boolean;
  readonly currentSuggestions: Map<string, PageSuggestion>;
  readonly currentComments: Map<string, PageComment>;
  readonly localToPersistedId: Map<string, string>;
  readonly pendingPersistTimers: Map<string, ReturnType<typeof setTimeout>>;
  readonly rollbackSnapshots: Map<string, SuggestionMemento>;
  readonly inFlightSuggestionCreates: Set<string>;
  readonly inFlightResolutions: Set<string>;
  readonly currentReviewStatuses: Map<string, string>;
}

export function getActiveViewFromState(state: ReviewCoordinatorState): EditorView | null {
  if (state.activePageId) {
    const views = state.viewsByFileId.get(state.activePageId);
    if (views && views.size > 0) {
      if (state.lastBoundView && views.has(state.lastBoundView)) {
        return state.lastBoundView;
      }
      let latest: EditorView | null = null;
      for (const v of views) latest = v;
      return latest;
    }
  }
  return state.lastBoundView;
}

export function getViewsForFileFromState(
  state: ReviewCoordinatorState,
  fileId?: string | null,
  fallbackView?: EditorView | null,
): EditorView[] {
  const result = new Set<EditorView>();
  if (fallbackView) result.add(fallbackView);
  const targetId = fileId || state.activePageId;
  if (targetId) {
    const views = state.viewsByFileId.get(targetId);
    if (views) {
      for (const v of views) result.add(v);
    }
  }
  const activeView = getActiveViewFromState(state);
  if (result.size === 0 && activeView) {
    result.add(activeView);
  }
  return Array.from(result);
}

export function syncStateDecorations(
  state: ReviewCoordinatorState,
  view: EditorView | null,
  suggestions: PageSuggestion[],
  comments: PageComment[],
  viewMode: TrackChangesViewMode = state.currentViewMode,
  reviewMode: boolean = state.currentReviewMode,
  docId?: string | null,
): void {
  const targetDocId = docId ?? state.activePageId;
  const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
  state.currentViewMode = viewMode;
  state.currentReviewMode = reviewMode;
  const targetViews = getViewsForFileFromState(state, targetDocId, view);

  syncDecorations({
    targetDocId,
    suggestions,
    comments,
    viewMode,
    reviewMode,
    yDoc,
    currentSuggestions: state.currentSuggestions,
    currentComments: state.currentComments,
    localToPersistedId: state.localToPersistedId,
    targetViews,
  });
}

function syncAllTargetViews(
  state: ReviewCoordinatorState,
  targetViews: EditorView[],
  docId: string | null | undefined,
): void {
  for (const view of targetViews) {
    syncStateDecorations(
      state,
      view,
      Array.from(state.currentSuggestions.values()),
      Array.from(state.currentComments.values()),
      state.currentViewMode,
      state.currentReviewMode,
      docId,
    );
  }
}

export function clearPendingPersistTimer(
  state: ReviewCoordinatorState,
  suggestionId: string,
): void {
  const timer = state.pendingPersistTimers.get(suggestionId);
  if (timer) {
    clearTimeout(timer);
    state.pendingPersistTimers.delete(suggestionId);
  }
}

export function resolveKnownSuggestion(
  state: ReviewCoordinatorState,
  suggestionId: string,
): PageSuggestion | undefined {
  const mappedId = state.localToPersistedId.get(suggestionId);
  const cached =
    state.currentSuggestions.get(suggestionId) ??
    (mappedId ? state.currentSuggestions.get(mappedId) : undefined);
  if (cached) return cached;
  const activeView = getActiveViewFromState(state);
  const stateSugs = activeView?.state.field(reviewStateField, false)?.suggestions || [];
  return stateSugs.find((s) => s.id === suggestionId || (mappedId && s.id === mappedId));
}

export function applySuggestionInState(
  state: ReviewCoordinatorState,
  view: EditorView,
  sug: PageSuggestion,
  action: 'accept' | 'reject',
): void {
  const targetDocId = sug.pageId || state.activePageId;
  const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
  const memento = mutateSuggestion(view, sug, action, yDoc);
  state.rollbackSnapshots.set(sug.id, memento);

  state.currentSuggestions.set(sug.id, {
    ...sug,
    status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
  });

  syncViewToCache(view, targetDocId);

  syncStateDecorations(
    state,
    view,
    Array.from(state.currentSuggestions.values()),
    Array.from(state.currentComments.values()),
    state.currentViewMode,
    state.currentReviewMode,
    targetDocId,
  );
}

export function rollbackSuggestionInState(
  state: ReviewCoordinatorState,
  suggestionId: string,
): void {
  const effectiveId = state.localToPersistedId.get(suggestionId) ?? suggestionId;
  const snap =
    state.rollbackSnapshots.get(effectiveId) || state.rollbackSnapshots.get(suggestionId);
  if (!snap) return;
  state.rollbackSnapshots.delete(effectiveId);
  state.rollbackSnapshots.delete(suggestionId);

  revertMemento(snap, state.activePageId);

  state.currentSuggestions.set(snap.sug.id, { ...snap.sug, status: 'pending' });
  syncStateDecorations(
    state,
    snap.view,
    Array.from(state.currentSuggestions.values()),
    Array.from(state.currentComments.values()),
    state.currentViewMode,
    state.currentReviewMode,
  );
}

export function applyAllInState(
  state: ReviewCoordinatorState,
  action: 'accept' | 'reject',
  docId?: string,
): void {
  for (const [localId, timer] of state.pendingPersistTimers.entries()) {
    const localSug = state.currentSuggestions.get(localId);
    if (!docId || !localSug?.pageId || localSug.pageId === docId) {
      clearTimeout(timer);
      state.pendingPersistTimers.delete(localId);
    }
  }
  const targetViews = getViewsForFileFromState(state, docId, getActiveViewFromState(state));
  if (targetViews.length === 0) return;
  const primaryView = targetViews[0];
  const doc = primaryView.state.doc;
  const stateSugs = primaryView.state.field(reviewStateField, false)?.suggestions || [];
  for (const s of stateSugs) {
    if (!state.currentSuggestions.has(s.id)) state.currentSuggestions.set(s.id, s);
  }
  const targetDocId = docId ?? state.activePageId;
  const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
  const pending = Array.from(state.currentSuggestions.values())
    .filter((s) => s.status === 'pending' && (!docId || !s.pageId || s.pageId === docId))
    .map((s) => ({ sug: s, range: resolveSuggestionRange(doc, s, yDoc) }))
    .sort((a, b) => b.range.from - a.range.from);

  for (const item of pending) {
    for (const view of targetViews) {
      applySuggestionInState(state, view, item.sug, action);
    }
  }
}

export function applySelectedInState(
  state: ReviewCoordinatorState,
  suggestionIds: string[],
  action: 'accept' | 'reject',
  docId?: string,
): void {
  for (const rawId of suggestionIds) clearPendingPersistTimer(state, rawId);
  const targetViews = getViewsForFileFromState(state, docId, getActiveViewFromState(state));
  if (targetViews.length === 0 || !suggestionIds.length) return;
  const doc = targetViews[0].state.doc;
  const resolved: { sug: PageSuggestion; range: { from: number; to: number } }[] = [];
  const seen = new Set<string>();

  const targetDocId = docId ?? state.activePageId;
  const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
  for (const rawId of suggestionIds) {
    const sug = resolveKnownSuggestion(state, rawId);
    if (sug && !seen.has(sug.id) && sug.status === 'pending') {
      seen.add(sug.id);
      resolved.push({ sug, range: resolveSuggestionRange(doc, sug, yDoc) });
    }
  }
  resolved.sort((a, b) => b.range.from - a.range.from);

  for (const item of resolved) {
    for (const view of targetViews) {
      applySuggestionInState(state, view, item.sug, action);
    }
  }
}

function captureStateSnapshot(
  state: ReviewCoordinatorState,
  docId?: string | null,
): ReviewRollbackSnapshot {
  const targetDocId = docId || state.activePageId;
  const targetViews = getViewsForFileFromState(
    state,
    targetDocId,
    getActiveViewFromState(state),
  );
  return captureSnapshot(targetDocId, targetViews, state.currentSuggestions);
}

function restoreStateSnapshot(
  state: ReviewCoordinatorState,
  snapshot: ReviewRollbackSnapshot,
): void {
  restoreSnapshot(snapshot);
  state.currentSuggestions.clear();
  for (const [id, sug] of snapshot.suggestions) {
    state.currentSuggestions.set(id, { ...sug });
  }
  for (const { view } of snapshot.viewDocs) {
    syncStateDecorations(
      state,
      view,
      Array.from(state.currentSuggestions.values()),
      Array.from(state.currentComments.values()),
      state.currentViewMode,
      state.currentReviewMode,
      snapshot.pageId,
    );
  }
}

export function isYjsSynced(docId?: string | null): boolean {
  if (!docId) return false;
  const provider = getActiveYjsProvider(docId);
  return Boolean(
    provider &&
      !provider.isDestroyed &&
      provider.status === 'connected' &&
      provider.isSynced,
  );
}

export function scheduleLocalCreate(
  state: ReviewCoordinatorState,
  docId: string,
  sug: PageSuggestion,
): void {
  const existingTimer = state.pendingPersistTimers.get(sug.id);
  if (existingTimer) clearTimeout(existingTimer);

  if (state.inFlightSuggestionCreates.has(sug.id) || state.localToPersistedId.has(sug.id)) {
    return;
  }

  const timer = setTimeout(() => {
    state.pendingPersistTimers.delete(sug.id);
    if (state.inFlightSuggestionCreates.has(sug.id) || state.localToPersistedId.has(sug.id)) {
      return;
    }
    const latest = state.currentSuggestions.get(sug.id) ?? sug;
    if (latest.status && latest.status !== 'pending') return;

    state.inFlightSuggestionCreates.add(sug.id);

    const provider = getActiveYjsProvider(docId);
    const yText = provider?.yText ?? null;
    const cachedRev = lruDocumentCache.getModel(docId)?.serverRev;
    const anchorStart =
      typeof latest.fromIndex === 'number'
        ? encodeYjsAnchor(yText, latest.fromIndex)
        : null;
    const anchorEnd =
      typeof latest.toIndex === 'number'
        ? encodeYjsAnchor(yText, latest.toIndex)
        : null;

    const servicePort = state.servicePort;
    const wireType: 'insert' | 'delete' =
      latest.type === 'delete' || (!latest.suggestedText && Boolean(latest.originalText))
        ? 'delete'
        : 'insert';
    const payload = {
      pageId: docId,
      type: wireType,
      originalText: latest.originalText || '',
      suggestedText: latest.suggestedText || '',
      fromLine: latest.fromLine || 1,
      fromColumn: Math.max(0, (latest.fromColumn ?? 1) - 1),
      toLine: latest.toLine || latest.fromLine || 1,
      toColumn: Math.max(0, (latest.toColumn ?? 1) - 1),
      ...(latest.groupId ? { groupId: latest.groupId } : {}),
      ...(anchorStart ? { anchorStart } : {}),
      ...(anchorEnd ? { anchorEnd } : {}),
      ...(typeof cachedRev === 'number' ? { baseDocRev: cachedRev } : {}),
      headers: { 'Idempotency-Key': sug.id },
      silent: true,
    };

    const createPromise = servicePort.createSuggestion
      ? servicePort.createSuggestion(payload)
      : pagesService.suggestions.createSuggestion(payload);

    void createPromise
      .then((created) => {
        state.inFlightSuggestionCreates.delete(sug.id);
        if (!created?.id) return;
        state.localToPersistedId.set(sug.id, created.id);
        const currentLocal = state.currentSuggestions.get(sug.id);
        if (currentLocal) {
          state.currentSuggestions.delete(sug.id);
          const merged: PageSuggestion = {
            ...currentLocal,
            ...created,
            id: created.id,
            pageId: created.pageId || docId,
            fromColumn: currentLocal.fromColumn,
            toColumn: currentLocal.toColumn,
            status: currentLocal.status ?? created.status ?? 'pending',
          };
          state.currentSuggestions.set(created.id, merged);

          if (currentLocal.status === 'accepted') {
            void servicePort.acceptSuggestion(docId, created.id).catch(() => {});
          } else if (currentLocal.status === 'rejected') {
            void servicePort.rejectSuggestion(docId, created.id).catch(() => {});
          }
        }

        const targetViews = getViewsForFileFromState(state, docId);
        for (const v of targetViews) {
          try {
            v.dispatch({
              effects: [
                setSuggestionsEffect.of(
                  Array.from(state.currentSuggestions.values()).filter(
                    (s) => !s.pageId || s.pageId === docId,
                  ),
                ),
              ],
            });
          } catch {
            // Ignore view dispatch errors if view was destroyed
          }
        }

        editorCommandBus.dispatch({
          type: 'editor:review-event',
          pageId: docId,
          event: 'suggestion:persisted',
          payload: { localId: sug.id, suggestion: created },
        });
      })
      .catch((err) => {
        state.inFlightSuggestionCreates.delete(sug.id);
        logger.debug('[ReviewCoordinator] Failed to persist local suggestion', { err });
      });
  }, 350);

  state.pendingPersistTimers.set(sug.id, timer);
}

export async function resolveOne(
  state: ReviewCoordinatorState,
  docId: string,
  suggestionId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  const effectiveId = state.localToPersistedId.get(suggestionId) ?? suggestionId;
  if (
    state.inFlightResolutions.has(suggestionId) ||
    state.inFlightResolutions.has(effectiveId)
  ) {
    return false;
  }

  state.inFlightResolutions.add(suggestionId);
  state.inFlightResolutions.add(effectiveId);

  try {
    clearPendingPersistTimer(state, suggestionId);
    if (effectiveId !== suggestionId) {
      clearPendingPersistTimer(state, effectiveId);
    }
    if (docId) {
      sessionCoordinator.cancelPendingAutoSave(docId);
    }

    const sug = resolveKnownSuggestion(state, suggestionId);
    const isLocalOnly = isLocalSuggestionId(effectiveId);
    const targetDocId = docId || sug?.pageId || state.activePageId || '';

    if (sug?.groupId) {
      const groupIds = Array.from(state.currentSuggestions.values())
        .filter(
          (item) =>
            item.groupId === sug.groupId &&
            item.status === 'pending' &&
            (!targetDocId || !item.pageId || item.pageId === targetDocId),
        )
        .map((item) => item.id);
      if (groupIds.length > 1) {
        const mappedIds = groupIds.map((id) => state.localToPersistedId.get(id) ?? id);
        for (const id of [...groupIds, ...mappedIds]) {
          state.inFlightResolutions.add(id);
        }
        try {
          return await resolveSelected(state, targetDocId, groupIds, action);
        } finally {
          for (const id of [...groupIds, ...mappedIds]) {
            state.inFlightResolutions.delete(id);
          }
        }
      }
    }

    const skipOptimisticSplice = !isLocalOnly && isYjsSynced(targetDocId);

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted' : 'suggestion:rejected';
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);

    if (sug) {
      const targetViews = getViewsForFileFromState(
        state,
        targetDocId,
        getActiveViewFromState(state),
      );
      if (!skipOptimisticSplice) {
        for (const view of targetViews) {
          applySuggestionInState(state, view, sug, action);
        }
      } else {
        state.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
        syncAllTargetViews(state, targetViews, targetDocId);
      }
    }

    if (isLocalOnly) {
      toast.success(`Change ${pastTense}`, { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event,
        payload: { suggestionId },
      });
      return true;
    }

    try {
      const res =
        action === 'accept'
          ? await state.servicePort.acceptSuggestion(docId, effectiveId)
          : await state.servicePort.rejectSuggestion(docId, effectiveId);
      const serverRev = (res as { page?: { rev?: number } } | undefined)?.page?.rev;
      if (typeof serverRev === 'number' && docId) {
        lruDocumentCache.setServerRev(docId, serverRev);
      }
      toast.success(`Change ${pastTense}`, { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event,
        payload: { suggestionId: effectiveId },
      });
      return true;
    } catch (err: unknown) {
      if (skipOptimisticSplice && sug) {
        state.currentSuggestions.set(sug.id, { ...sug, status: 'pending' });
        syncAllTargetViews(
          state,
          getViewsForFileFromState(state, targetDocId, getActiveViewFromState(state)),
          targetDocId,
        );
      } else {
        rollbackSuggestionInState(state, effectiveId);
      }
      toast.error((err as Error)?.message || `Failed to ${action} change`, {
        id: `sug-${suggestionId}`,
      });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'suggestion:rollback',
        payload: { suggestionId: effectiveId },
      });
      return false;
    }
  } finally {
    state.inFlightResolutions.delete(suggestionId);
    state.inFlightResolutions.delete(effectiveId);
  }
}

export async function resolveAll(
  state: ReviewCoordinatorState,
  docId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  for (const [localId, timer] of state.pendingPersistTimers.entries()) {
    const localSug = state.currentSuggestions.get(localId);
    if (!docId || !localSug?.pageId || localSug.pageId === docId) {
      clearTimeout(timer);
      state.pendingPersistTimers.delete(localId);
    }
  }
  if (docId) {
    sessionCoordinator.cancelPendingAutoSave(docId);
  }

  const targetViews = getViewsForFileFromState(state, docId, getActiveViewFromState(state));
  const primaryView = targetViews[0];
  if (primaryView) {
    const stateSugs = primaryView.state.field(reviewStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!state.currentSuggestions.has(s.id)) {
        state.currentSuggestions.set(s.id, s);
      }
    }
  }
  const pending = Array.from(state.currentSuggestions.values()).filter(
    (s) => s.status === 'pending' && (!docId || !s.pageId || s.pageId === docId),
  );
  const hasServerPending = pending.some((s) => !isLocalSuggestionId(s.id));
  const isPurelyLocal = pending.length > 0 && !hasServerPending;
  const skipOptimisticSplice = hasServerPending && isYjsSynced(docId);
  const rollbackSnap = !skipOptimisticSplice ? captureStateSnapshot(state, docId) : null;

  if (!skipOptimisticSplice) {
    applyAllInState(state, action, docId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const s of pending) {
      state.currentSuggestions.set(s.id, { ...s, status: nextStatus });
    }
    syncAllTargetViews(state, targetViews, docId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event = action === 'accept' ? 'suggestion:accepted-all' : 'suggestion:rejected-all';

  if (isPurelyLocal) {
    toast.success(`All changes ${pastTense}`, { id: 'sug-bulk' });
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
    });
    return true;
  }

  try {
    const res =
      action === 'accept'
        ? await state.servicePort.acceptAllSuggestions(docId)
        : await state.servicePort.rejectAllSuggestions(docId);
    syncServerDoc(docId, res, targetViews);
    toast.success(`All changes ${pastTense}`, { id: 'sug-bulk' });
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
    });
    return true;
  } catch (err: unknown) {
    if (skipOptimisticSplice) {
      for (const s of pending) {
        state.currentSuggestions.set(s.id, { ...s, status: 'pending' });
      }
      syncAllTargetViews(state, targetViews, docId);
    } else if (rollbackSnap) {
      restoreStateSnapshot(state, rollbackSnap);
    }
    toast.error((err as Error)?.message || `Failed to ${action} all changes`, {
      id: 'sug-bulk',
    });
    return false;
  }
}

export async function resolveSelected(
  state: ReviewCoordinatorState,
  docId: string,
  suggestionIds: string[],
  action: 'accept' | 'reject',
): Promise<boolean> {
  if (!suggestionIds || suggestionIds.length === 0) return true;

  for (const id of suggestionIds) {
    clearPendingPersistTimer(state, id);
  }
  if (docId) {
    sessionCoordinator.cancelPendingAutoSave(docId);
  }

  const persistedIds = suggestionIds
    .map((id) => state.localToPersistedId.get(id) ?? id)
    .filter((id) => !isLocalSuggestionId(id));
  const skipOptimisticSplice = persistedIds.length > 0 && isYjsSynced(docId);
  const targetViews = getViewsForFileFromState(state, docId, getActiveViewFromState(state));
  const prevSnapshots: PageSuggestion[] = [];
  const rollbackSnap = !skipOptimisticSplice ? captureStateSnapshot(state, docId) : null;

  if (!skipOptimisticSplice) {
    applySelectedInState(state, suggestionIds, action, docId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const rawId of suggestionIds) {
      const sug = resolveKnownSuggestion(state, rawId);
      if (sug && sug.status === 'pending') {
        prevSnapshots.push({ ...sug });
        state.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
      }
    }
    syncAllTargetViews(state, targetViews, docId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event =
    action === 'accept' ? 'suggestion:accepted-selected' : 'suggestion:rejected-selected';

  if (persistedIds.length === 0) {
    toast.success(`${suggestionIds.length} changes ${pastTense}`, { id: 'sug-bulk' });
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
      payload: { suggestionIds },
    });
    return true;
  }

  try {
    const res = state.servicePort.batchResolve
      ? await state.servicePort.batchResolve(docId, { suggestionIds: persistedIds, action })
      : action === 'accept'
        ? await state.servicePort.acceptSelectedSuggestions(docId, persistedIds)
        : await state.servicePort.rejectSelectedSuggestions(docId, persistedIds);
    syncServerDoc(docId, res, targetViews);
    toast.success(`${suggestionIds.length} changes ${pastTense}`, { id: 'sug-bulk' });
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
      payload: { suggestionIds: persistedIds },
    });
    return true;
  } catch (err: unknown) {
    if (skipOptimisticSplice && prevSnapshots.length > 0) {
      for (const prev of prevSnapshots) {
        state.currentSuggestions.set(prev.id, prev);
      }
      syncAllTargetViews(state, targetViews, docId);
    } else if (rollbackSnap) {
      restoreStateSnapshot(state, rollbackSnap);
    }
    toast.error((err as Error)?.message || `Failed to ${action} selected changes`, {
      id: 'sug-bulk',
    });
    return false;
  }
}
