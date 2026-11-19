/**
 * session-offline-sync.ts
 *
 * Offline Queueing, Outbox Replay, and Multi-Tab Event Handling for SessionCoordinator.
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
  pendingOutboxStore,
} from '@/features/editor/domain/offline-storage';
import { EDITOR_LIMITS } from '@/features/editor/domain/constants/editor.constants';
import {
  evictYjsProviderByDocId,
  getActiveYjsProvider,
} from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { multiTabBus, withWebLock } from '@/shared/lib/multi-tab';
import {
  getAllRegisteredEngines,
  getEditorEngineForFile,
  getActiveEditorEngine,
  editorCommandBus,
} from '../bus/command-bus';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { useConnectivityStore } from '../store/connectivity.store';
import { useWorkspaceStore } from '../store/workspace.store';
import type { UnsyncedEditsCoordinator } from './unsynced-edits.coordinator';
import type { DocumentConflictCoordinator } from './document-conflict.coordinator';
import {
  persistWithRetry,
  finalizeSuccessfulSave,
  handleSaveConflictOrError,
  type SessionPersistenceHost,
} from './session-persistence.strategy';

export interface OfflineMutationModel {
  projectId?: string;
  spaceId?: string;
  pageId?: string;
  content: string;
  filePath?: string;
  serverRev?: number;
}

export function enqueueOfflineEditHelper(
  host: Pick<SessionPersistenceHost, 'unsyncedEdits' | 'resolveEffectiveProjectId'>,
  fileId: string,
  model: OfflineMutationModel,
  options?: { flushImmediate?: boolean },
): void {
  const cachedModel = lruDocumentCache.getModel(fileId);
  const expectedRev = model.serverRev ?? cachedModel?.serverRev;
  if (options?.flushImmediate !== false) {
    host.unsyncedEdits.flushNow(fileId, model.content, model.projectId);
  }
  const effectiveProjectId = host.resolveEffectiveProjectId(model.projectId);
  void pendingOutboxStore
    .enqueue({
      fileId,
      projectId: effectiveProjectId,
      spaceId: model.spaceId ?? cachedModel?.spaceId,
      pageId: model.pageId ?? cachedModel?.pageId,
      type: 'update_content',
      payload: {
        content: model.content,
        filePath: model.filePath,
        ...(expectedRev !== undefined ? { expectedRev } : {}),
      },
    })
    .then(async () => {
      const list = await pendingOutboxStore.getPending().catch(() => []);
      useConnectivityStore.getState().setPendingMutationsCount(list.length);
      multiTabBus.publish({
        type: 'OFFLINE_OUTBOX_MUTATED',
        action: 'ENQUEUED',
        count: list.length,
      });
    })
    .catch(() => {});
}

export function flushViaOfflineQueueStrategy(
  host: SessionPersistenceHost,
  fileId: string,
  model: OfflineMutationModel,
): boolean {
  useConnectivityStore.getState().setSyncStatus('offline');
  host.saveUnsyncedEdit(fileId, model.content, model.projectId);
  host.enqueueOfflineEdit(fileId, model, { flushImmediate: false });
  return false;
}

export async function replayPendingOfflineMutations(
  host: SessionPersistenceHost,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const lockResult = await withWebLock(
    EDITOR_LIMITS.OFFLINE_REPLAY_LOCK_NAME,
    async () => {
      const pending = await pendingOutboxStore.getPending();
      useConnectivityStore.getState().setPendingMutationsCount(pending.length);
      if (pending.length === 0) {
        return { total: 0, succeeded: 0, failed: 0 };
      }

      let succeeded = 0;
      let failed = 0;

      const mutationsByFile = new Map<string, typeof pending>();
      for (const mut of pending) {
        const list = mutationsByFile.get(mut.fileId);
        if (list) {
          list.push(mut);
        } else {
          mutationsByFile.set(mut.fileId, [mut]);
        }
      }

      await Promise.allSettled(
        Array.from(mutationsByFile.values()).map(async (fileMutations) => {
          for (const mut of fileMutations) {
            if (mut.type === 'update_content' && mut.payload.content !== undefined) {
              const content = mut.payload.content as string;
              const cachedModel = lruDocumentCache.getModel(mut.fileId);
              const expectedRev =
                (mut.payload.expectedRev as number | undefined) ?? cachedModel?.serverRev;
              try {
                await persistWithRetry(host.persistenceAdapter, mut.fileId, content, expectedRev);
                await finalizeSuccessfulSave(host, mut.fileId, content);
                if (mut.id) {
                  await pendingOutboxStore.remove(mut.id);
                }
                await unsyncedEditsStore.clear(mut.fileId);
                succeeded++;
              } catch (err) {
                await handleSaveConflictOrError(host, mut.fileId, content, err);
                const errMsg = err instanceof Error ? err.message : String(err);
                if (mut.id) {
                  await pendingOutboxStore.updateStatus(mut.id, 'failed', errMsg);
                }
                failed++;
              }
            }
          }
        }),
      );

      const remaining = await pendingOutboxStore.getPending().catch(() => []);
      useConnectivityStore.getState().setPendingMutationsCount(remaining.length);

      if (succeeded > 0 && failed === 0) {
        useConnectivityStore.getState().setSyncStatus('synced');
        useConnectivityStore.getState().setLastSavedAt(new Date());
      }

      if (succeeded > 0 || failed > 0) {
        multiTabBus.publish({
          type: 'OFFLINE_OUTBOX_MUTATED',
          action: failed > 0 && succeeded === 0 ? 'FAILED' : 'FLUSHED',
          count: remaining.length,
        });
      }

      return { total: pending.length, succeeded, failed };
    },
    { ifAvailable: true },
  );

  if (lockResult === null) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  return lockResult;
}

export function dispatchMultiTabSyncEvent(
  event: Parameters<Parameters<typeof multiTabBus.subscribe>[0]>[0],
  reindex: (fileId: string, content: string) => void,
): void {
  if (event.type === 'OFFLINE_OUTBOX_MUTATED') {
    useConnectivityStore.getState().setPendingMutationsCount(event.count);
    if (event.action === 'FLUSHED' && event.count === 0) {
      const conn = useConnectivityStore.getState();
      if (conn.isOnline && conn.pendingSaveCount === 0) {
        conn.setSyncStatus('synced');
      }
    }
    return;
  }

  if (event.type === 'EDITOR_UNSYNCED_EDIT_UPDATED') {
    if (getActiveYjsProvider(event.fileId)) {
      return;
    }
    const model = lruDocumentCache.getModel(event.fileId);
    if (model && model.content !== event.content) {
      lruDocumentCache.applyRemoteContent(event.fileId, event.content);
      reindex(event.fileId, event.content);
      editorCommandBus.dispatch({
        type: 'editor:set-content',
        fileId: event.fileId,
        content: event.content,
      });
    }
  }
}

export function performEmergencyUnloadSave(
  resolveProjectId: (modelProjectId?: string) => string,
): boolean {
  const dirtyModels = lruDocumentCache.getDirtyModels();
  if (dirtyModels.length === 0) return false;

  const activeId = lruDocumentCache.getActiveFileId();
  const prioritized = activeId
    ? [
        ...dirtyModels.filter((m) => m.fileId === activeId),
        ...dirtyModels.filter((m) => m.fileId !== activeId),
      ]
    : dirtyModels;
  for (const m of prioritized.slice(0, 2)) {
    unsyncedEditsStore.saveEmergencyUnload(
      m.fileId,
      m.content,
      resolveProjectId(m.projectId),
      m.filePath,
      m.serverRev,
    );
  }
  return true;
}

export function clearDeletedFileSessionResources(params: {
  fileId: string;
  unsyncedEdits: UnsyncedEditsCoordinator;
  conflicts: DocumentConflictCoordinator;
  lastCompiledContentMap: Map<string, string>;
  realtimeConnected: Map<string, boolean>;
  fsmContexts: Map<string, unknown>;
  clearUnsyncedEdit: (fileId: string) => void;
}): void {
  const {
    fileId,
    unsyncedEdits,
    conflicts,
    lastCompiledContentMap,
    realtimeConnected,
    fsmContexts,
    clearUnsyncedEdit,
  } = params;
  evictYjsProviderByDocId(fileId, { skipFlush: true });
  fsmContexts.delete(fileId);
  warmEditorStatePool.delete(fileId);
  lruDocumentCache.markClean(fileId);
  lruDocumentCache.evictModel(fileId, { skipPersistence: true });
  useCompileStore.getState().clearDirty(fileId);
  clearUnsyncedEdit(fileId);
  void syncedDocCacheStore.delete(fileId);
  void pendingOutboxStore.removeByDocId(fileId).catch(() => {});
  lastCompiledContentMap.delete(fileId);
  realtimeConnected.delete(fileId);
  unsyncedEdits.evictFile(fileId);
  conflicts.evictFile(fileId);
}

export function finalizeTabCloseEviction(params: {
  fileId: string;
  hasInFlightFlush: boolean;
  flushFile: (fileId: string) => Promise<boolean>;
  saveUnsyncedEdit: (fileId: string, content: string, projectId?: string) => void;
  flushPendingUnsyncedEdits: () => void;
  unsyncedEdits: UnsyncedEditsCoordinator;
  conflicts: DocumentConflictCoordinator;
  lastCompiledContentMap: Map<string, string>;
  realtimeConnected: Map<string, boolean>;
}): void {
  const {
    fileId,
    hasInFlightFlush,
    flushFile,
    saveUnsyncedEdit,
    flushPendingUnsyncedEdits,
    unsyncedEdits,
    conflicts,
    lastCompiledContentMap,
    realtimeConnected,
  } = params;
  warmEditorStatePool.delete(fileId);
  const model = lruDocumentCache.getModel(fileId);
  if (model?.isDirty) {
    saveUnsyncedEdit(fileId, model.content, model.projectId);
    flushPendingUnsyncedEdits();
  }
  lastCompiledContentMap.delete(fileId);
  realtimeConnected.delete(fileId);

  const finalizeEviction = () => {
    const wsState = useWorkspaceStore.getState();
    const stillOpenInAnyTab = Object.values(wsState.tabsByProject).some((tabs) =>
      tabs?.some((t) => t.id === fileId),
    );
    if (!stillOpenInAnyTab && !lruDocumentCache.isDirty(fileId)) {
      lruDocumentCache.evictModel(fileId);
      unsyncedEdits.evictFile(fileId);
      conflicts.evictFile(fileId);
    }
  };

  if (model?.isDirty || hasInFlightFlush) {
    void flushFile(fileId).finally(finalizeEviction);
  } else {
    lruDocumentCache.evictModel(fileId);
    unsyncedEdits.evictFile(fileId);
    conflicts.evictFile(fileId);
  }
}

export function executeSwitchTabDeactivate(params: {
  fromFileId: string | null;
  toFileId: string;
  transitionDeactivate: (fileId: string) => void;
  transitionActivate: (fileId: string) => void;
  saveUnsyncedEdit: (fileId: string, content: string, projectId?: string) => void;
  flushPendingUnsyncedEdits: () => void;
}): void {
  const {
    fromFileId,
    toFileId,
    transitionDeactivate,
    transitionActivate,
    saveUnsyncedEdit,
    flushPendingUnsyncedEdits,
  } = params;
  if (fromFileId && fromFileId !== toFileId) {
    const registeredCount = getAllRegisteredEngines?.()?.size ?? 0;
    const fromEngine =
      getEditorEngineForFile?.(fromFileId) ??
      (registeredCount === 0 ? getActiveEditorEngine() : null);
    const fromContent = fromEngine?.getContent();
    const fromModel = lruDocumentCache.getModel(fromFileId);
    if (fromContent !== undefined && fromModel && fromModel.content !== fromContent) {
      lruDocumentCache.updateContent(fromFileId, fromContent, true);
      useCompileStore.getState().markDirty(fromFileId, fromContent);
    }

    transitionDeactivate(fromFileId);
    const updatedFromModel = lruDocumentCache.getModel(fromFileId);
    if (updatedFromModel && updatedFromModel.isDirty) {
      saveUnsyncedEdit(fromFileId, updatedFromModel.content, updatedFromModel.projectId);
      flushPendingUnsyncedEdits();
    }
  }
  transitionActivate(toFileId);
  lruDocumentCache.setActiveFileId(toFileId);
}

export function executeRemoteContentUpdatedHelper(params: {
  fileId: string;
  remoteContent: string;
  isRealtimeConnected: (fileId: string) => boolean;
  transitionRemoteEdit: (fileId: string, version: number) => void;
  transitionConflictDetected: (fileId: string) => void;
  reindex: (fileId: string, content: string) => void;
  unsyncedEdits: UnsyncedEditsCoordinator;
  conflicts: DocumentConflictCoordinator;
}): void {
  const {
    fileId,
    remoteContent,
    isRealtimeConnected,
    transitionRemoteEdit,
    transitionConflictDetected,
    reindex,
    unsyncedEdits,
    conflicts,
  } = params;
  const model = lruDocumentCache.getModel(fileId);
  if (!model?.isDirty) {
    lruDocumentCache.updateContent(fileId, remoteContent, false);
    lruDocumentCache.markClean(fileId);
    useCompileStore.getState().clearDirty(fileId);
    const v = lruDocumentCache.getContentVersion(fileId) || 0;
    transitionRemoteEdit(fileId, v);
    reindex(fileId, remoteContent);
    return;
  }
  if (model.content === remoteContent) {
    conflicts.clearConflict(fileId);
    return;
  }
  if (isRealtimeConnected(fileId)) return;

  transitionConflictDetected(fileId);
  unsyncedEdits.flushNow(fileId, model.content, model.projectId);
  conflicts.recordConflict(fileId, model.content, remoteContent);
}
