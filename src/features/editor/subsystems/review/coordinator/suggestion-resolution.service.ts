/**
 * suggestion-resolution.service.ts
 *
 * Debounced local suggestion persistence and single/bulk/selected suggestion
 * resolution orchestration (with Yjs live-presence awareness & rollback support).
 */

import { type EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import {
  trackChangesStateField,
  setTrackChangesSuggestionsEffect,
  type TrackChangesViewMode,
} from '@/features/editor/subsystems/review/extensions/track-changes-state';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type {
  ReviewNotificationPort,
  ReviewServicePort,
  ReviewStorePort,
} from '@/features/editor/subsystems/review/model/review-service-port';
import { syncServerPatchedDocumentToViews } from './suggestion-buffer-mutator';

export const defaultReviewServicePort: ReviewServicePort = {
  acceptSuggestion: (pageId, suggestionId) =>
    pagesService.suggestions.acceptSuggestion(pageId, suggestionId),
  rejectSuggestion: (pageId, suggestionId) =>
    pagesService.suggestions.rejectSuggestion(pageId, suggestionId),
  acceptAllSuggestions: (pageId) =>
    pagesService.suggestions.acceptAllSuggestions(pageId),
  rejectAllSuggestions: (pageId) =>
    pagesService.suggestions.rejectAllSuggestions(pageId),
  acceptSelectedSuggestions: (pageId, suggestionIds) =>
    pagesService.suggestions.acceptSelectedSuggestions(pageId, suggestionIds),
  rejectSelectedSuggestions: (pageId, suggestionIds) =>
    pagesService.suggestions.rejectSelectedSuggestions(pageId, suggestionIds),
  batchResolve: (pageId, payload) =>
    pagesService.suggestions.batchResolve(pageId, payload),
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

export interface SuggestionResolutionHost {
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
  readonly pendingConcurrentUpdates: Map<string, { pageId: string; sug: PageSuggestion }>;
  readonly getViewsForFile: (fileId?: string | null, fallbackView?: EditorView | null) => EditorView[];
  readonly resolveKnownSuggestion: (suggestionId: string) => PageSuggestion | undefined;
  readonly clearPendingPersistTimer: (suggestionId: string) => void;
  readonly applySuggestionLocally: (view: EditorView, sug: PageSuggestion, action: 'accept' | 'reject') => void;
  readonly applyAllLocally: (action: 'accept' | 'reject', pageId?: string) => void;
  readonly applySelectedLocally: (suggestionIds: string[], action: 'accept' | 'reject', pageId?: string) => void;
  readonly rollbackSuggestionLocally: (suggestionId: string) => void;
  readonly syncEditorDecorations: (
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode?: TrackChangesViewMode,
    reviewMode?: boolean,
    pageId?: string | null,
  ) => void;
}

export function hasSyncedYjsForPage(pageId?: string | null): boolean {
  if (!pageId) return false;
  const liveProvider = getActiveYjsProvider(pageId);
  return Boolean(
    liveProvider &&
      !liveProvider.isDestroyed &&
      liveProvider.status === 'connected' &&
      liveProvider.isSynced,
  );
}

export function scheduleLocalSuggestionCreate(
  host: SuggestionResolutionHost,
  pageId: string,
  sug: PageSuggestion,
): void {
  const existingTimer = host.pendingPersistTimers.get(sug.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  if (host.inFlightSuggestionCreates.has(sug.id) || host.localToPersistedId.has(sug.id)) {
    if (host.inFlightSuggestionCreates.has(sug.id)) {
      host.pendingConcurrentUpdates.set(sug.id, { pageId, sug });
    }
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
    const createPayload = {
      pageId,
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
      ? servicePort.createSuggestion(createPayload)
      : pagesService.suggestions.createSuggestion(createPayload);

    void createPromise
      .then((created) => {
        host.inFlightSuggestionCreates.delete(sug.id);
        host.pendingConcurrentUpdates.delete(sug.id);
        if (!created?.id) return;
        host.localToPersistedId.set(sug.id, created.id);
        const currentLocal = host.currentSuggestions.get(sug.id);
        if (currentLocal) {
          host.currentSuggestions.delete(sug.id);
          const mergedPersisted: PageSuggestion = {
            ...currentLocal,
            ...created,
            id: created.id,
            pageId: created.pageId || pageId,
            status: currentLocal.status ?? created.status ?? 'pending',
          };
          host.currentSuggestions.set(created.id, mergedPersisted);

          if (currentLocal.status === 'accepted') {
            void servicePort.acceptSuggestion(pageId, created.id).catch(() => {});
          } else if (currentLocal.status === 'rejected') {
            void servicePort.rejectSuggestion(pageId, created.id).catch(() => {});
          }
        }

        const targetViews = host.getViewsForFile(pageId);
        for (const v of targetViews) {
          try {
            v.dispatch({
              effects: [
                setTrackChangesSuggestionsEffect.of(
                  Array.from(host.currentSuggestions.values()).filter(
                    (s) => !s.pageId || s.pageId === pageId,
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
          pageId,
          event: 'suggestion:persisted',
          payload: { localId: sug.id, suggestion: created },
        });
      })
      .catch((err) => {
        host.inFlightSuggestionCreates.delete(sug.id);
        host.pendingConcurrentUpdates.delete(sug.id);
        console.debug('[ReviewCoordinator] Failed to persist local suggestion:', err);
      });
  }, 350);

  host.pendingPersistTimers.set(sug.id, timer);
}

function syncAllTargetViews(
  host: SuggestionResolutionHost,
  targetViews: EditorView[],
  pageId: string | null | undefined,
): void {
  for (const view of targetViews) {
    host.syncEditorDecorations(
      view,
      Array.from(host.currentSuggestions.values()),
      Array.from(host.currentComments.values()),
      host.getViewMode(),
      host.getReviewMode(),
      pageId,
    );
  }
}

export async function executeResolveSingleSuggestion(
  host: SuggestionResolutionHost,
  pageId: string,
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
    if (pageId) {
      sessionCoordinator.cancelPendingAutoSave(pageId);
    }

    const sug = host.resolveKnownSuggestion(suggestionId);
    const isLocalOnly = effectiveId.startsWith('sug-local-');
    const targetPageId = pageId || sug?.pageId || host.getActivePageId();
    const skipOptimisticBufferSplice = !isLocalOnly && hasSyncedYjsForPage(targetPageId);

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted' : 'suggestion:rejected';
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);

    if (sug) {
      const targetViews = host.getViewsForFile(targetPageId, host.getActiveView());
      if (!skipOptimisticBufferSplice) {
        for (const view of targetViews) {
          host.applySuggestionLocally(view, sug, action);
        }
      } else {
        host.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
        syncAllTargetViews(host, targetViews, targetPageId);
      }
    }

    const notificationPort = host.getNotificationPort();
    if (isLocalOnly) {
      notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionId },
      });
      return true;
    }

    const servicePort = host.getServicePort();
    try {
      const res =
        action === 'accept'
          ? await servicePort.acceptSuggestion(pageId, effectiveId)
          : await servicePort.rejectSuggestion(pageId, effectiveId);
      const serverRev = (res as { page?: { rev?: number } } | undefined)?.page?.rev;
      if (typeof serverRev === 'number' && pageId) {
        lruDocumentCache.setServerRev(pageId, serverRev);
      }
      notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionId: effectiveId },
      });
      return true;
    } catch (err: unknown) {
      if (skipOptimisticBufferSplice && sug) {
        host.currentSuggestions.set(sug.id, { ...sug, status: 'pending' });
        syncAllTargetViews(host, host.getViewsForFile(targetPageId, host.getActiveView()), targetPageId);
      } else {
        host.rollbackSuggestionLocally(effectiveId);
      }
      notificationPort.notifyError(
        (err as Error)?.message || `Failed to ${action} change`,
        `sug-${suggestionId}`,
      );
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
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

export async function executeResolveAllSuggestions(
  host: SuggestionResolutionHost,
  pageId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  for (const [localId, timer] of host.pendingPersistTimers.entries()) {
    clearTimeout(timer);
    host.pendingPersistTimers.delete(localId);
  }
  if (pageId) {
    sessionCoordinator.cancelPendingAutoSave(pageId);
  }

  const targetViews = host.getViewsForFile(pageId, host.getActiveView());
  const primaryView = targetViews[0];
  if (primaryView) {
    const stateSugs = primaryView.state.field(trackChangesStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!host.currentSuggestions.has(s.id)) {
        host.currentSuggestions.set(s.id, s);
      }
    }
  }
  const pendingForPage = Array.from(host.currentSuggestions.values()).filter(
    (s) => s.status === 'pending' && (!pageId || !s.pageId || s.pageId === pageId),
  );
  const hasServerPending = pendingForPage.some((s) => !s.id.startsWith('sug-local-'));
  const skipOptimisticBufferSplice = hasServerPending && hasSyncedYjsForPage(pageId);

  if (!skipOptimisticBufferSplice) {
    host.applyAllLocally(action, pageId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const s of pendingForPage) {
      host.currentSuggestions.set(s.id, { ...s, status: nextStatus });
    }
    syncAllTargetViews(host, targetViews, pageId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event = action === 'accept' ? 'suggestion:accepted-all' : 'suggestion:rejected-all';
  const servicePort = host.getServicePort();
  const notificationPort = host.getNotificationPort();

  try {
    const res =
      action === 'accept'
        ? await servicePort.acceptAllSuggestions(pageId)
        : await servicePort.rejectAllSuggestions(pageId);
    syncServerPatchedDocumentToViews(pageId, res, targetViews);
    notificationPort.notifySuccess(`All changes ${pastTense}`, 'sug-bulk');
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId,
      event,
    });
    return true;
  } catch (err: unknown) {
    if (skipOptimisticBufferSplice) {
      for (const s of pendingForPage) {
        host.currentSuggestions.set(s.id, { ...s, status: 'pending' });
      }
      syncAllTargetViews(host, targetViews, pageId);
    }
    notificationPort.notifyError(
      (err as Error)?.message || `Failed to ${action} all changes`,
      'sug-bulk',
    );
    return false;
  }
}

export async function executeResolveSelectedSuggestions(
  host: SuggestionResolutionHost,
  pageId: string,
  suggestionIds: string[],
  action: 'accept' | 'reject',
): Promise<boolean> {
  if (!suggestionIds || suggestionIds.length === 0) return true;

  for (const id of suggestionIds) {
    host.clearPendingPersistTimer(id);
  }
  if (pageId) {
    sessionCoordinator.cancelPendingAutoSave(pageId);
  }

  const persistedIds = suggestionIds
    .map((id) => host.localToPersistedId.get(id) ?? id)
    .filter((id) => !id.startsWith('sug-local-'));
  const skipOptimisticBufferSplice = persistedIds.length > 0 && hasSyncedYjsForPage(pageId);
  const targetViews = host.getViewsForFile(pageId, host.getActiveView());
  const prevSnapshots: PageSuggestion[] = [];

  if (!skipOptimisticBufferSplice) {
    host.applySelectedLocally(suggestionIds, action, pageId);
  } else {
    const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
    for (const rawId of suggestionIds) {
      const sug = host.resolveKnownSuggestion(rawId);
      if (sug && sug.status === 'pending') {
        prevSnapshots.push({ ...sug });
        host.currentSuggestions.set(sug.id, { ...sug, status: nextStatus });
      }
    }
    syncAllTargetViews(host, targetViews, pageId);
  }

  const pastTense = action === 'accept' ? 'accepted' : 'rejected';
  const event =
    action === 'accept' ? 'suggestion:accepted-selected' : 'suggestion:rejected-selected';
  const notificationPort = host.getNotificationPort();

  if (persistedIds.length === 0) {
    notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId,
      event,
      payload: { suggestionIds },
    });
    return true;
  }

  const servicePort = host.getServicePort();
  try {
    const res = servicePort.batchResolve
      ? await servicePort.batchResolve(pageId, { suggestionIds: persistedIds, action })
      : action === 'accept'
        ? await servicePort.acceptSelectedSuggestions(pageId, persistedIds)
        : await servicePort.rejectSelectedSuggestions(pageId, persistedIds);
    syncServerPatchedDocumentToViews(pageId, res, targetViews);
    notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId,
      event,
      payload: { suggestionIds: persistedIds },
    });
    return true;
  } catch (err: unknown) {
    if (skipOptimisticBufferSplice && prevSnapshots.length > 0) {
      for (const prev of prevSnapshots) {
        host.currentSuggestions.set(prev.id, prev);
      }
      syncAllTargetViews(host, targetViews, pageId);
    }
    notificationPort.notifyError(
      (err as Error)?.message || `Failed to ${action} selected changes`,
      'sug-bulk',
    );
    return false;
  }
}
