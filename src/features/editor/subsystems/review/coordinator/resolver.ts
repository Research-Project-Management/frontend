import type { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  isLocalSuggestionId,
  reviewStateField,
  setSuggestionsEffect,
  type TrackChangesViewMode,
} from '../extensions/state';
import type {
  ReviewNotificationPort,
  ReviewServicePort,
  ReviewStorePort,
} from '../model/ports';
import { syncServerDoc } from './buffer';

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

export const defaultReviewNotificationPort: ReviewNotificationPort = {
  notifySuccess: (message: string, id?: string) => {
    toast.success(message, id ? { id } : undefined);
  },
  notifyError: (message: string, id?: string) => {
    toast.error(message, id ? { id } : undefined);
  },
};

export const defaultReviewStorePort: ReviewStorePort = {
  setPendingComment: (payload) => {
    useDocumentCollaborationStore.getState().setPendingComment(payload);
  },
  openReviewSidebar: () => {
    useWorkspaceStore.getState().setActiveSidebarTab('review');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
  },
};

export interface ResolutionHost {
  readonly getServicePort: () => ReviewServicePort;
  readonly getNotificationPort: () => ReviewNotificationPort;
  readonly getActivePageId: () => string | null;
  readonly getActiveView: () => EditorView | null;
  readonly getViewMode: () => TrackChangesViewMode;
  readonly getReviewMode: () => boolean;
  readonly currentSuggestions: Map<string, PageSuggestion>;
  readonly currentComments: Map<string, PageComment>;
  readonly localToPersistedId: Map<string, string>;
  readonly pendingPersistTimers: Map<string, ReturnType<typeof setTimeout>>;
  readonly inFlightSuggestionCreates: Set<string>;
  readonly inFlightResolutions: Set<string>;
  readonly getViewsForFile: (fileId?: string | null, fallbackView?: EditorView | null) => EditorView[];
  readonly resolveKnownSuggestion: (suggestionId: string) => PageSuggestion | undefined;
  readonly clearPendingPersistTimer: (suggestionId: string) => void;
  readonly applySuggestionLocally: (view: EditorView, sug: PageSuggestion, action: 'accept' | 'reject') => void;
  readonly applyAllLocally: (action: 'accept' | 'reject', docId?: string) => void;
  readonly applySelectedLocally: (suggestionIds: string[], action: 'accept' | 'reject', docId?: string) => void;
  readonly rollbackSuggestionLocally: (suggestionId: string) => void;
  readonly syncEditorDecorations: (
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode?: TrackChangesViewMode,
    reviewMode?: boolean,
    docId?: string | null,
  ) => void;
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
  host: ResolutionHost,
  docId: string,
  sug: PageSuggestion,
): void {
  const existingTimer = host.pendingPersistTimers.get(sug.id);
  if (existingTimer) clearTimeout(existingTimer);

  if (host.inFlightSuggestionCreates.has(sug.id) || host.localToPersistedId.has(sug.id)) {
    return;
  }

  const timer = setTimeout(() => {
    host.pendingPersistTimers.delete(sug.id);
    if (host.inFlightSuggestionCreates.has(sug.id) || host.localToPersistedId.has(sug.id)) {
      return;
    }
    const latest = host.currentSuggestions.get(sug.id) ?? sug;
    if (latest.status && latest.status !== 'pending') return;

    host.inFlightSuggestionCreates.add(sug.id);

    const servicePort = host.getServicePort();
    const payload = {
      pageId: docId,
      type: latest.type,
      originalText: latest.originalText || '',
      suggestedText: latest.suggestedText || '',
      fromLine: latest.fromLine || 1,
      fromColumn: latest.fromColumn || 1,
      toLine: latest.toLine || latest.fromLine || 1,
      toColumn: latest.toColumn || 1,
      idempotencyKey: sug.id,
      silent: true,
    };

    const createPromise = servicePort.createSuggestion
      ? servicePort.createSuggestion(payload)
      : pagesService.suggestions.createSuggestion(payload);

    void createPromise
      .then((created) => {
        host.inFlightSuggestionCreates.delete(sug.id);
        if (!created?.id) return;
        host.localToPersistedId.set(sug.id, created.id);
        const currentLocal = host.currentSuggestions.get(sug.id);
        if (currentLocal) {
          host.currentSuggestions.delete(sug.id);
          const merged: PageSuggestion = {
            ...currentLocal,
            ...created,
            id: created.id,
            pageId: created.pageId || docId,
            status: currentLocal.status ?? created.status ?? 'pending',
          };
          host.currentSuggestions.set(created.id, merged);

          if (currentLocal.status === 'accepted') {
            void servicePort.acceptSuggestion(docId, created.id).catch(() => {});
          } else if (currentLocal.status === 'rejected') {
            void servicePort.rejectSuggestion(docId, created.id).catch(() => {});
          }
        }

        const targetViews = host.getViewsForFile(docId);
        for (const v of targetViews) {
          try {
            v.dispatch({
              effects: [
                setSuggestionsEffect.of(
                  Array.from(host.currentSuggestions.values()).filter(
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
        host.inFlightSuggestionCreates.delete(sug.id);
        console.debug('[ReviewCoordinator] Failed to persist local suggestion:', err);
      });
  }, 350);

  host.pendingPersistTimers.set(sug.id, timer);
}

function syncAllTargetViews(
  host: ResolutionHost,
  targetViews: EditorView[],
  docId: string | null | undefined,
): void {
  for (const view of targetViews) {
    host.syncEditorDecorations(
      view,
      Array.from(host.currentSuggestions.values()),
      Array.from(host.currentComments.values()),
      host.getViewMode(),
      host.getReviewMode(),
      docId,
    );
  }
}

export async function resolveOne(
  host: ResolutionHost,
  docId: string,
  suggestionId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  const effectiveId = host.localToPersistedId.get(suggestionId) ?? suggestionId;
  if (
    host.inFlightResolutions.has(suggestionId) ||
    host.inFlightResolutions.has(effectiveId)
  ) {
    return false;
  }

  host.inFlightResolutions.add(suggestionId);
  host.inFlightResolutions.add(effectiveId);

  try {
    host.clearPendingPersistTimer(suggestionId);
    if (effectiveId !== suggestionId) {
      host.clearPendingPersistTimer(effectiveId);
    }
    if (docId) {
      sessionCoordinator.cancelPendingAutoSave(docId);
    }

    const sug = host.resolveKnownSuggestion(suggestionId);
    const isLocalOnly = isLocalSuggestionId(effectiveId);
    const targetDocId = docId || sug?.pageId || host.getActivePageId();
    const skipOptimisticSplice = !isLocalOnly && isYjsSynced(targetDocId);

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted' : 'suggestion:rejected';
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);

    if (sug) {
      const targetViews = host.getViewsForFile(targetDocId, host.getActiveView());
      if (!skipOptimisticSplice) {
        for (const view of targetViews) {
          host.applySuggestionLocally(view, sug, action);
        }
      } else {
        host.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
        syncAllTargetViews(host, targetViews, targetDocId);
      }
    }

    const notificationPort = host.getNotificationPort();
    if (isLocalOnly) {
      notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event,
        payload: { suggestionId },
      });
      return true;
    }

    const servicePort = host.getServicePort();
    try {
      const res =
        action === 'accept'
          ? await servicePort.acceptSuggestion(docId, effectiveId)
          : await servicePort.rejectSuggestion(docId, effectiveId);
      const serverRev = (res as { page?: { rev?: number } } | undefined)?.page?.rev;
      if (typeof serverRev === 'number' && docId) {
        lruDocumentCache.setServerRev(docId, serverRev);
      }
      notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event,
        payload: { suggestionId: effectiveId },
      });
      return true;
    } catch (err: unknown) {
      if (skipOptimisticSplice && sug) {
        host.currentSuggestions.set(sug.id, { ...sug, status: 'pending' });
        syncAllTargetViews(host, host.getViewsForFile(targetDocId, host.getActiveView()), targetDocId);
      } else {
        host.rollbackSuggestionLocally(effectiveId);
      }
      notificationPort.notifyError(
        (err as Error)?.message || `Failed to ${action} change`,
        `sug-${suggestionId}`,
      );
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'suggestion:rollback',
        payload: { suggestionId: effectiveId },
      });
      return false;
    }
  } finally {
    host.inFlightResolutions.delete(suggestionId);
    host.inFlightResolutions.delete(effectiveId);
  }
}

export async function resolveAll(
  host: ResolutionHost,
  docId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  for (const [localId, timer] of host.pendingPersistTimers.entries()) {
    clearTimeout(timer);
    host.pendingPersistTimers.delete(localId);
  }
  if (docId) {
    sessionCoordinator.cancelPendingAutoSave(docId);
  }

  const targetViews = host.getViewsForFile(docId, host.getActiveView());
  const primaryView = targetViews[0];
  if (primaryView) {
    const stateSugs = primaryView.state.field(reviewStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!host.currentSuggestions.has(s.id)) {
        host.currentSuggestions.set(s.id, s);
      }
    }
  }
  const pending = Array.from(host.currentSuggestions.values()).filter(
    (s) => s.status === 'pending' && (!docId || !s.pageId || s.pageId === docId),
  );
  const hasServerPending = pending.some((s) => !isLocalSuggestionId(s.id));
  const skipOptimisticSplice = hasServerPending && isYjsSynced(docId);

  if (!skipOptimisticSplice) {
    host.applyAllLocally(action, docId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const s of pending) {
      host.currentSuggestions.set(s.id, { ...s, status: nextStatus });
    }
    syncAllTargetViews(host, targetViews, docId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event = action === 'accept' ? 'suggestion:accepted-all' : 'suggestion:rejected-all';
  const servicePort = host.getServicePort();
  const notificationPort = host.getNotificationPort();

  try {
    const res =
      action === 'accept'
        ? await servicePort.acceptAllSuggestions(docId)
        : await servicePort.rejectAllSuggestions(docId);
    syncServerDoc(docId, res, targetViews);
    notificationPort.notifySuccess(`All changes ${pastTense}`, 'sug-bulk');
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
    });
    return true;
  } catch (err: unknown) {
    if (skipOptimisticSplice) {
      for (const s of pending) {
        host.currentSuggestions.set(s.id, { ...s, status: 'pending' });
      }
      syncAllTargetViews(host, targetViews, docId);
    }
    notificationPort.notifyError(
      (err as Error)?.message || `Failed to ${action} all changes`,
      'sug-bulk',
    );
    return false;
  }
}

export async function resolveSelected(
  host: ResolutionHost,
  docId: string,
  suggestionIds: string[],
  action: 'accept' | 'reject',
): Promise<boolean> {
  if (!suggestionIds || suggestionIds.length === 0) return true;

  for (const id of suggestionIds) {
    host.clearPendingPersistTimer(id);
  }
  if (docId) {
    sessionCoordinator.cancelPendingAutoSave(docId);
  }

  const persistedIds = suggestionIds
    .map((id) => host.localToPersistedId.get(id) ?? id)
    .filter((id) => !isLocalSuggestionId(id));
  const skipOptimisticSplice = persistedIds.length > 0 && isYjsSynced(docId);
  const targetViews = host.getViewsForFile(docId, host.getActiveView());
  const prevSnapshots: PageSuggestion[] = [];

  if (!skipOptimisticSplice) {
    host.applySelectedLocally(suggestionIds, action, docId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const rawId of suggestionIds) {
      const sug = host.resolveKnownSuggestion(rawId);
      if (sug && sug.status === 'pending') {
        prevSnapshots.push({ ...sug });
        host.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
      }
    }
    syncAllTargetViews(host, targetViews, docId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event =
    action === 'accept' ? 'suggestion:accepted-selected' : 'suggestion:rejected-selected';
  const notificationPort = host.getNotificationPort();

  if (persistedIds.length === 0) {
    notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId: docId,
      event,
      payload: { suggestionIds },
    });
    return true;
  }

  const servicePort = host.getServicePort();
  try {
    const res = servicePort.batchResolve
      ? await servicePort.batchResolve(docId, { suggestionIds: persistedIds, action })
      : action === 'accept'
        ? await servicePort.acceptSelectedSuggestions(docId, persistedIds)
        : await servicePort.rejectSelectedSuggestions(docId, persistedIds);
    syncServerDoc(docId, res, targetViews);
    notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
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
        host.currentSuggestions.set(prev.id, prev);
      }
      syncAllTargetViews(host, targetViews, docId);
    }
    notificationPort.notifyError(
      (err as Error)?.message || `Failed to ${action} selected changes`,
      'sug-bulk',
    );
    return false;
  }
}
