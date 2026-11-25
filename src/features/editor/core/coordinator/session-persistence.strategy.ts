/**
 * session-persistence.strategy.ts
 *
 * REST CAS retry, conflict resolution extraction, realtime Yjs flush, and
 * post-save bookkeeping strategies for SessionCoordinator.
 */

import { lruDocumentCache, type DocumentModelState } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
} from '@/features/editor/domain/offline-storage';
import { type sessionFsmTransition } from '@/features/editor/domain/document/session-fsm';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  markHttpSavedWhileDisconnected,
  flushYjsProvider,
} from '@/features/editor/sdk/realtime/provider';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { useConnectivityStore, isNetworkError } from '../store/connectivity.store';
import { editorCommandBus } from '../bus/command-bus';
import type { UnsyncedEditsCoordinator } from './unsynced-edits.coordinator';
import type { DocumentConflictCoordinator } from './document-conflict.coordinator';

const TRANSIENT_ERROR_MSG_REGEX =
  /timeout|timed out|too many requests|bad gateway|service unavailable|gateway timeout/i;
const CONFLICT_ERROR_MSG_REGEX = /\b409\b|conflict/i;

export interface DocumentPersistencePort {
  updateContent(
    fileId: string,
    content: string,
    options?: { expectedRev?: number; expectedVersion?: number },
  ): Promise<unknown>;
  getById?(
    fileId: string,
  ): Promise<
    | { content?: unknown; rev?: number; version?: number; lines?: string[]; updatedAt?: string }
    | null
    | undefined
  >;
}

/**
 * Pure policy: HTTP autosave is required unless a realtime CRDT channel is actually connected.
 */
export function shouldUseRealtimePersistence(input: {
  hasYText: boolean;
  isOnline: boolean;
  isProviderConnected: boolean;
  isProviderSynced?: boolean;
}): boolean {
  return (
    input.hasYText &&
    input.isOnline &&
    input.isProviderConnected &&
    (input.isProviderSynced ?? true)
  );
}

function isTransientSaveError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (status !== undefined) {
    return false;
  }
  return err instanceof Error && TRANSIENT_ERROR_MSG_REGEX.test(err.message);
}

export function clearWorkspaceTabDirty(fileId: string, projectId?: string): void {
  const wsState = useWorkspaceStore.getState();
  const targetScopes = projectId
    ? [projectId, ...Object.keys(wsState.tabsByProject)]
    : Object.keys(wsState.tabsByProject);
  const visited = new Set<string>();
  for (const scope of targetScopes) {
    if (!scope || visited.has(scope)) continue;
    visited.add(scope);
    const tabs = wsState.tabsByProject[scope];
    if (tabs?.some((t) => t.id === fileId && t.isDirty)) {
      wsState.markTabDirty(scope, fileId, false);
    }
  }
}

export async function persistWithRetry(
  adapter: DocumentPersistencePort,
  fileId: string,
  sentContent: string,
  expectedRev?: number,
): Promise<unknown> {
  const maxAttempts = 3;
  const baseDelayMs = 300;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res =
        expectedRev !== undefined
          ? await adapter.updateContent(fileId, sentContent, { expectedRev })
          : await adapter.updateContent(fileId, sentContent);
      if (res && typeof res === 'object') {
        const r = res as {
          rev?: number;
          hash?: string | null;
          updatedAt?: string;
          page?: { rev?: number; hash?: string | null; updatedAt?: string };
          data?: {
            rev?: number;
            hash?: string | null;
            updatedAt?: string;
            page?: { rev?: number; hash?: string | null; updatedAt?: string };
          };
        };
        const rev = r.rev ?? r.page?.rev ?? r.data?.rev ?? r.data?.page?.rev;
        const hash = r.hash ?? r.page?.hash ?? r.data?.hash ?? r.data?.page?.hash;
        const updatedAt =
          r.updatedAt ?? r.page?.updatedAt ?? r.data?.updatedAt ?? r.data?.page?.updatedAt;
        if (rev !== undefined || hash !== undefined || updatedAt !== undefined) {
          lruDocumentCache.updateServerVersion(fileId, {
            rev,
            hash,
            updatedAt,
          });
        }
      }
      return res;
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status === 409 || attempt >= maxAttempts || !isTransientSaveError(err)) {
        throw err;
      }
      const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
    }
  }

  throw lastError;
}

export interface SessionPersistenceHost {
  readonly persistenceAdapter: DocumentPersistencePort;
  readonly unsyncedEdits: UnsyncedEditsCoordinator;
  readonly conflicts: DocumentConflictCoordinator;
  readonly autoSaveDelay: number;
  transitionFsm(fileId: string, event: Parameters<typeof sessionFsmTransition>[1]): void;
  resolveEffectiveProjectId(modelProjectId?: string): string;
  isRealtimeConnected(fileId: string): boolean;
  scheduleAutoSave(fileId: string, delayMs: number): void;
  saveUnsyncedEdit(fileId: string, content: string, projectId?: string): void;
  clearUnsyncedEdit(fileId: string): void;
  enqueueOfflineEdit(
    fileId: string,
    model: {
      projectId?: string;
      spaceId?: string;
      pageId?: string;
      content: string;
      filePath?: string;
      serverRev?: number;
    },
    options?: { flushImmediate?: boolean },
  ): void;
}

export async function finalizeSuccessfulSave(
  host: SessionPersistenceHost,
  fileId: string,
  sentContent: string,
  sentVersion?: number,
): Promise<boolean> {
  markHttpSavedWhileDisconnected(fileId);

  const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
  host.transitionFsm(fileId, {
    type: 'SAVE_SUCCESS',
    savedVersion: sentVersion ?? currentVersion,
    currentVersion,
  });

  const model = lruDocumentCache.getModel(fileId);
  if (!model) {
    const edit = await unsyncedEditsStore.get(fileId).catch(() => null);
    if (!edit || edit.content === sentContent) {
      lruDocumentCache.markClean(fileId);
      clearWorkspaceTabDirty(fileId);
      host.clearUnsyncedEdit(fileId);
      return true;
    }
    return false;
  }
  if (lruDocumentCache.markCleanIfUnchanged(fileId, sentContent, sentVersion)) {
    lruDocumentCache.markClean(fileId);
    clearWorkspaceTabDirty(fileId, model.projectId);
    host.clearUnsyncedEdit(fileId);
    const effectiveProjectId = host.resolveEffectiveProjectId(model.projectId);
    void syncedDocCacheStore.put({
      id: fileId,
      projectId: effectiveProjectId,
      title: model.filePath || fileId,
      content: sentContent,
      filePath: model.filePath,
      rev: model.serverRev,
      hash: model.hash,
      updatedAt: Date.now(),
    });
    latexSymbolsIndex.refreshFromServer(effectiveProjectId);
    return true;
  }
  if (!host.isRealtimeConnected(fileId)) {
    host.scheduleAutoSave(fileId, host.autoSaveDelay);
  }
  return false;
}

export async function handleSaveConflictOrError(
  host: SessionPersistenceHost,
  fileId: string,
  sentContent: string,
  err: unknown,
  sentVersion?: number,
): Promise<boolean> {
  const model = lruDocumentCache.getModel(fileId);
  const status = (err as { status?: number })?.status;
  const isConflict =
    status === 409 ||
    (err as { code?: string })?.code === 'CONFLICT' ||
    (err as { code?: string })?.code === 'DOC_VERSION_CONFLICT' ||
    (err instanceof Error && CONFLICT_ERROR_MSG_REGEX.test(err.message));

  if (isConflict) {
    const errObj =
      err && typeof err === 'object' ? (err as Record<string, unknown>) : undefined;
    const details = (err as { details?: Record<string, unknown> })?.details;
    let remoteRev = [
      details?.currentRev,
      details?.rev,
      details?.remoteRev,
      errObj?.currentRev,
      errObj?.rev,
      errObj?.remoteRev,
    ].find((v): v is number => typeof v === 'number');

    let resolvedRemoteContent = [
      details?.remoteContent,
      details?.content,
      errObj?.remoteContent,
      errObj?.content,
    ].find((v): v is string => typeof v === 'string');

    if (
      resolvedRemoteContent === undefined &&
      typeof host.persistenceAdapter.getById === 'function'
    ) {
      try {
        const latest = await host.persistenceAdapter.getById(fileId);
        if (latest && typeof latest === 'object') {
          if (typeof latest.content === 'string') {
            resolvedRemoteContent = latest.content;
          } else if (Array.isArray(latest.lines)) {
            resolvedRemoteContent = latest.lines.join('\n');
          }
          if (
            typeof latest.rev === 'number' &&
            (remoteRev === undefined || latest.rev > remoteRev)
          ) {
            remoteRev = latest.rev;
          }
        }
      } catch {
        // Non-fatal fallback; guard below prevents empty overwrite
      }
    }

    const localContent = model?.content ?? sentContent;

    // Case A: Server already has identical content — resync rev cleanly without conflict UI
    if (
      typeof resolvedRemoteContent === 'string' &&
      resolvedRemoteContent === localContent
    ) {
      if (remoteRev !== undefined) {
        lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
      }
      await finalizeSuccessfulSave(host, fileId, sentContent, sentVersion);
      useConnectivityStore.getState().setSyncStatus('synced');
      return true;
    }

    // Case B: Stale local serverRev (e.g. after Yjs/self-save) — server matches our last synced snapshot
    const cachedSynced = await syncedDocCacheStore.get(fileId).catch(() => null);
    if (
      typeof resolvedRemoteContent === 'string' &&
      remoteRev !== undefined &&
      cachedSynced?.content === resolvedRemoteContent
    ) {
      lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
      try {
        await persistWithRetry(host.persistenceAdapter, fileId, sentContent, remoteRev);
        await finalizeSuccessfulSave(host, fileId, sentContent, sentVersion);
        useConnectivityStore.getState().setSyncStatus('synced');
        return true;
      } catch {
        // Fall through to real conflict reporting if retry fails
      }
    }

    host.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });
    if (remoteRev !== undefined) {
      lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
    }
    const hasAuthoritativeRemote = typeof resolvedRemoteContent === 'string';
    host.unsyncedEdits.flushNow(fileId, localContent, model?.projectId);
    host.conflicts.recordConflict(
      fileId,
      localContent,
      resolvedRemoteContent ?? '',
      {
        currentRev: remoteRev,
        hasAuthoritativeRemote,
      },
    );
    useConnectivityStore.getState().setSyncStatus('error');
    return false;
  }

  host.transitionFsm(fileId, { type: 'SAVE_FAILURE', error: err });
  if (isNetworkError(err) && model) {
    useConnectivityStore.getState().recordOffline();
    host.saveUnsyncedEdit(fileId, model.content, model.projectId);
    host.enqueueOfflineEdit(fileId, model, { flushImmediate: false });
  } else {
    useConnectivityStore.getState().setSyncStatus('error');
  }
  return false;
}

const pendingRealtimeFlushVersions = new Map<string, number>();

function commitCleanState(
  host: SessionPersistenceHost,
  docId: string,
  projectId: string | undefined,
  savedVersion: number,
  currentVersion: number,
  savedAt?: string,
): void {
  const model = lruDocumentCache.getModel(docId);
  host.clearUnsyncedEdit(docId);
  lruDocumentCache.markSaved(docId);
  lruDocumentCache.markClean(docId);
  clearWorkspaceTabDirty(docId, projectId);
  if (model) {
    const effectiveProjectId = host.resolveEffectiveProjectId(model.projectId);
    void syncedDocCacheStore.put({
      id: docId,
      projectId: effectiveProjectId,
      title: model.filePath || docId,
      content: model.content,
      filePath: model.filePath,
      rev: model.serverRev,
      hash: model.hash,
      updatedAt: savedAt ? new Date(savedAt).getTime() : Date.now(),
    });
  }
  host.transitionFsm(docId, {
    type: 'SAVE_SUCCESS',
    savedVersion,
    currentVersion,
  });
  useConnectivityStore.getState().setSyncStatus('synced');
  useConnectivityStore.getState().setLastSavedAt(savedAt ? new Date(savedAt) : new Date());
}

export function flushViaRealtimeYjsStrategy(
  host: SessionPersistenceHost,
  fileId: string,
  projectId?: string,
): boolean {
  const effectiveProjectId = host.resolveEffectiveProjectId(projectId);
  flushYjsProvider(effectiveProjectId, fileId);
  const model = lruDocumentCache.getModel(fileId);
  if (model) {
    host.saveUnsyncedEdit(fileId, model.content, effectiveProjectId);
  }
  const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
  pendingRealtimeFlushVersions.set(fileId, currentVersion);
  host.transitionFsm(fileId, { type: 'SAVE_START' });
  useConnectivityStore.getState().setSyncStatus('saving');
  return true;
}

export function handleDocumentPersisted(
  host: SessionPersistenceHost,
  payload: { docId: string; rev?: number; version?: number; savedAt?: string },
): void {
  const { docId, rev, savedAt } = payload;
  if (!docId) return;

  const model = lruDocumentCache.getModel(docId);
  if (rev !== undefined && model?.serverRev !== undefined && rev < model.serverRev) {
    return;
  }

  if (rev !== undefined || savedAt !== undefined) {
    lruDocumentCache.updateServerVersion(docId, {
      rev,
      updatedAt: savedAt,
    });
  }

  const currentVersion = lruDocumentCache.getContentVersion(docId) || 0;
  const flushedVersion = pendingRealtimeFlushVersions.get(docId);
  if (flushedVersion !== undefined && currentVersion > flushedVersion) {
    host.transitionFsm(docId, {
      type: 'SAVE_SUCCESS',
      savedVersion: flushedVersion,
      currentVersion,
    });
    useConnectivityStore.getState().setLastSavedAt(savedAt ? new Date(savedAt) : new Date());
    return;
  }

  pendingRealtimeFlushVersions.delete(docId);
  commitCleanState(host, docId, model?.projectId, currentVersion, currentVersion, savedAt);
}

export async function flushViaRestCasStrategy(
  host: SessionPersistenceHost,
  fileId: string,
  model: { content: string; serverRev?: number },
): Promise<boolean> {
  host.transitionFsm(fileId, { type: 'SAVE_START' });

  const sentContent = model.content;
  const sentVersion = lruDocumentCache.getContentVersion(fileId);
  const expectedRev = model.serverRev;
  try {
    useConnectivityStore.getState().incrementPending();
    await persistWithRetry(host.persistenceAdapter, fileId, sentContent, expectedRev);
    const clean = await finalizeSuccessfulSave(host, fileId, sentContent, sentVersion);
    useConnectivityStore.getState().decrementPending();
    useConnectivityStore.getState().setLastSavedAt(new Date());
    return clean;
  } catch (err) {
    useConnectivityStore.getState().decrementPending();
    const resolvedCleanly = await handleSaveConflictOrError(
      host,
      fileId,
      sentContent,
      err,
      sentVersion,
    );
    if (resolvedCleanly) {
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return true;
    }
    console.error(`[SessionCoordinator] Failed to flush file ${fileId}:`, err);
    return false;
  }
}

export function executeResolveConflictHelper(params: {
  host: SessionPersistenceHost;
  fileId: string;
  resolution: 'keep-local' | 'take-remote' | 'custom-merge';
  mergedContent?: string;
  reindex: (fileId: string, content: string) => void;
}): void {
  const { host, fileId, resolution, mergedContent, reindex } = params;
  const conflict = host.conflicts.takeConflict(fileId);
  if (!conflict) return;

  host.transitionFsm(fileId, { type: 'CONFLICT_RESOLVED', resolution });

  if (resolution === 'take-remote') {
    host.unsyncedEdits.flushNow(
      fileId,
      conflict.localContent,
      lruDocumentCache.getModel(fileId)?.projectId,
    );
    if (
      conflict.hasAuthoritativeRemote === false &&
      conflict.remoteContent === '' &&
      conflict.localContent.length > 0
    ) {
      console.warn(
        `[SessionCoordinator] Refusing 'take-remote' empty overwrite for ${fileId}: authoritative remote content unavailable.`,
      );
      return;
    }
    lruDocumentCache.updateContent(fileId, conflict.remoteContent, false);
    lruDocumentCache.markClean(fileId);
    reindex(fileId, conflict.remoteContent);
    editorCommandBus.dispatch({
      type: 'editor:set-content',
      content: conflict.remoteContent,
      fileId,
    });
  } else if (resolution === 'custom-merge' && typeof mergedContent === 'string') {
    host.unsyncedEdits.flushNow(
      fileId,
      conflict.localContent,
      lruDocumentCache.getModel(fileId)?.projectId,
    );
    lruDocumentCache.updateContent(fileId, mergedContent, true);
    reindex(fileId, mergedContent);
    editorCommandBus.dispatch({
      type: 'editor:set-content',
      content: mergedContent,
      fileId,
    });
    host.scheduleAutoSave(fileId, host.autoSaveDelay);
  } else {
    host.scheduleAutoSave(fileId, host.autoSaveDelay);
  }
}

export async function executeFlushAllDirtyModelsHelper(params: {
  dirtyModels: DocumentModelState[];
  flushFile: (fileId: string) => Promise<boolean>;
  enqueueOfflineEdit: (fileId: string, model: DocumentModelState) => void;
}): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ fileId: string; success: boolean; error?: unknown }>;
}> {
  const { dirtyModels, flushFile, enqueueOfflineEdit } = params;
  const isOnline = useConnectivityStore.getState().checkIsOnline();

  if (!isOnline) {
    useConnectivityStore.getState().setSyncStatus('offline');
    for (const model of dirtyModels) {
      enqueueOfflineEdit(model.fileId, model);
    }
    return { total: dirtyModels.length, succeeded: 0, failed: 0, results: [] };
  }

  const results: Array<{ fileId: string; success: boolean; error?: unknown }> = [];
  let succeeded = 0;
  let failed = 0;

  const flushPromises = dirtyModels.map(async (model) => {
    try {
      const ok = await flushFile(model.fileId);
      if (ok || !lruDocumentCache.getModel(model.fileId)?.isDirty) {
        succeeded++;
        results.push({ fileId: model.fileId, success: true });
      } else {
        failed++;
        results.push({ fileId: model.fileId, success: false });
      }
    } catch (err) {
      failed++;
      results.push({ fileId: model.fileId, success: false, error: err });
    }
  });

  await Promise.allSettled(flushPromises);
  return { total: dirtyModels.length, succeeded, failed, results };
}
