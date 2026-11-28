/**
 * session-persistence.strategy.ts
 *
 * REST CAS retry, conflict resolution, realtime Yjs flush, and tab/session
 * lifecycle helpers for SessionCoordinator (zero offline shadow DB).
 */

import { logger } from '@/shared/lib/logger';
import {
  lruDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import { type sessionFsmTransition } from '@/features/editor/domain/document/session-fsm';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import {
  markHttpSavedWhileDisconnected,
  flushYjsProvider,
  evictYjsProviderByDocId,
} from '@/features/editor/sdk/realtime';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import {
  editorCommandBus,
  getAllRegisteredEngines,
  getEditorEngineForFile,
  getActiveEditorEngine,
} from '../bus/command-bus';
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
  readonly conflicts: DocumentConflictCoordinator;
  readonly autoSaveDelay: number;
  transitionFsm(fileId: string, event: Parameters<typeof sessionFsmTransition>[1]): void;
  resolveEffectiveProjectId(modelProjectId?: string): string;
  isRealtimeConnected(fileId: string): boolean;
  scheduleAutoSave(fileId: string, delayMs: number): void;
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
    lruDocumentCache.markClean(fileId);
    clearWorkspaceTabDirty(fileId);
    return true;
  }
  if (lruDocumentCache.markCleanIfUnchanged(fileId, sentContent, sentVersion)) {
    lruDocumentCache.markClean(fileId);
    clearWorkspaceTabDirty(fileId, model.projectId);
    const effectiveProjectId = host.resolveEffectiveProjectId(model.projectId);
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

    if (
      typeof resolvedRemoteContent === 'string' &&
      resolvedRemoteContent === localContent
    ) {
      if (remoteRev !== undefined) {
        lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
      }
      await finalizeSuccessfulSave(host, fileId, sentContent, sentVersion);
      return true;
    }

    host.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });
    if (remoteRev !== undefined) {
      lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
    }
    const hasAuthoritativeRemote = typeof resolvedRemoteContent === 'string';
    host.conflicts.recordConflict(
      fileId,
      localContent,
      resolvedRemoteContent ?? '',
      {
        currentRev: remoteRev,
        hasAuthoritativeRemote,
      },
    );
    return false;
  }

  host.transitionFsm(fileId, { type: 'SAVE_FAILURE', error: err });
  return false;
}

const pendingRealtimeFlushVersions = new Map<string, number>();

function commitCleanState(
  host: SessionPersistenceHost,
  docId: string,
  projectId: string | undefined,
  savedVersion: number,
  currentVersion: number,
): void {
  lruDocumentCache.markSaved(docId);
  lruDocumentCache.markClean(docId);
  clearWorkspaceTabDirty(docId, projectId);
  host.transitionFsm(docId, {
    type: 'SAVE_SUCCESS',
    savedVersion,
    currentVersion,
  });
}

export function flushViaRealtimeYjsStrategy(
  host: SessionPersistenceHost,
  fileId: string,
  projectId?: string,
): boolean {
  const effectiveProjectId = host.resolveEffectiveProjectId(projectId);
  flushYjsProvider(effectiveProjectId, fileId);
  const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
  pendingRealtimeFlushVersions.set(fileId, currentVersion);
  host.transitionFsm(fileId, { type: 'SAVE_START' });
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
    return;
  }

  pendingRealtimeFlushVersions.delete(docId);
  commitCleanState(host, docId, model?.projectId, currentVersion, currentVersion);
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
    await persistWithRetry(host.persistenceAdapter, fileId, sentContent, expectedRev);
    return await finalizeSuccessfulSave(host, fileId, sentContent, sentVersion);
  } catch (err) {
    const resolvedCleanly = await handleSaveConflictOrError(
      host,
      fileId,
      sentContent,
      err,
      sentVersion,
    );
    if (resolvedCleanly) return true;
    logger.error(`[SessionCoordinator] Failed to flush file ${fileId}`, err);
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
    if (
      conflict.hasAuthoritativeRemote === false &&
      conflict.remoteContent === '' &&
      conflict.localContent.length > 0
    ) {
      logger.warn(
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
}): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ fileId: string; success: boolean; error?: unknown }>;
}> {
  const { dirtyModels, flushFile } = params;
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

export function clearDeletedFileSessionResources(params: {
  fileId: string;
  conflicts: DocumentConflictCoordinator;
  lastCompiledContentMap: Map<string, string>;
  realtimeConnected: Map<string, boolean>;
  fsmContexts: Map<string, unknown>;
}): void {
  const { fileId, conflicts, lastCompiledContentMap, realtimeConnected, fsmContexts } = params;
  evictYjsProviderByDocId(fileId, { skipFlush: true });
  fsmContexts.delete(fileId);
  warmEditorStatePool.delete(fileId);
  lruDocumentCache.markClean(fileId);
  lruDocumentCache.evictModel(fileId, { skipPersistence: true });
  lastCompiledContentMap.delete(fileId);
  realtimeConnected.delete(fileId);
  conflicts.evictFile(fileId);
}

export function finalizeTabCloseEviction(params: {
  fileId: string;
  hasInFlightFlush: boolean;
  flushFile: (fileId: string) => Promise<boolean>;
  conflicts: DocumentConflictCoordinator;
  lastCompiledContentMap: Map<string, string>;
  realtimeConnected: Map<string, boolean>;
}): void {
  const {
    fileId,
    hasInFlightFlush,
    flushFile,
    conflicts,
    lastCompiledContentMap,
    realtimeConnected,
  } = params;
  warmEditorStatePool.delete(fileId);
  const model = lruDocumentCache.getModel(fileId);
  lastCompiledContentMap.delete(fileId);
  realtimeConnected.delete(fileId);

  const finalizeEviction = () => {
    const wsState = useWorkspaceStore.getState();
    const stillOpenInAnyTab = Object.values(wsState.tabsByProject).some((tabs) =>
      tabs?.some((t) => t.id === fileId),
    );
    if (!stillOpenInAnyTab && !lruDocumentCache.isDirty(fileId)) {
      lruDocumentCache.evictModel(fileId);
      conflicts.evictFile(fileId);
    }
  };

  if (model?.isDirty || hasInFlightFlush) {
    void flushFile(fileId).finally(finalizeEviction);
  } else {
    lruDocumentCache.evictModel(fileId);
    conflicts.evictFile(fileId);
  }
}

export function executeSwitchTabDeactivate(params: {
  fromFileId: string | null;
  toFileId: string;
  transitionDeactivate: (fileId: string) => void;
  transitionActivate: (fileId: string) => void;
}): void {
  const { fromFileId, toFileId, transitionDeactivate, transitionActivate } = params;
  if (fromFileId && fromFileId !== toFileId) {
    const registeredCount = getAllRegisteredEngines?.()?.size ?? 0;
    const fromEngine =
      getEditorEngineForFile?.(fromFileId) ??
      (registeredCount === 0 ? getActiveEditorEngine() : null);
    const fromContent = fromEngine?.getContent();
    const fromModel = lruDocumentCache.getModel(fromFileId);
    if (fromContent !== undefined && fromModel && fromModel.content !== fromContent) {
      lruDocumentCache.updateContent(fromFileId, fromContent, true);
    }
    transitionDeactivate(fromFileId);
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
  conflicts: DocumentConflictCoordinator;
}): void {
  const {
    fileId,
    remoteContent,
    isRealtimeConnected,
    transitionRemoteEdit,
    transitionConflictDetected,
    reindex,
    conflicts,
  } = params;
  const model = lruDocumentCache.getModel(fileId);
  if (!model?.isDirty) {
    lruDocumentCache.updateContent(fileId, remoteContent, false);
    lruDocumentCache.markClean(fileId);
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
  conflicts.recordConflict(fileId, model.content, remoteContent);
}
