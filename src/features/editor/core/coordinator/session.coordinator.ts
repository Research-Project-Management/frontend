/**
 * session.coordinator.ts
 *
 * Unified Document Session Coordinator (Deep Module - Coordinators Layer):
 * - Finite State Machine: Tracks document session lifecycle to prevent race conditions.
 * - Single source of truth for in-memory & persisted document state.
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  type UnsyncedDocEdit,
  type SyncedDocCacheEntry,
} from '@/features/editor/domain/offline-storage';
import {
  createInitialSessionContext,
  sessionFsmTransition,
  type DocumentSessionState,
  type SessionFsmContext,
} from '@/features/editor/domain/document/session-fsm';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { useConnectivityStore } from '../store/connectivity.store';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { multiTabBus } from '@/shared/lib/multi-tab';
import { editorCommandBus } from '../bus/command-bus';
import { visibilityCoordinator } from './visibility.coordinator';
import { UnsyncedEditsCoordinator } from './unsynced-edits.coordinator';
import {
  DocumentConflictCoordinator,
  type DocumentConflict,
  type ConflictListener,
} from './document-conflict.coordinator';
import {
  shouldUseRealtimePersistence,
  clearWorkspaceTabDirty,
  flushViaRealtimeYjsStrategy,
  flushViaRestCasStrategy,
  handleDocumentPersisted,
  executeResolveConflictHelper,
  executeFlushAllDirtyModelsHelper,
  type DocumentPersistencePort,
  type SessionPersistenceHost,
} from './session-persistence.strategy';
import {
  enqueueOfflineEditHelper,
  flushViaOfflineQueueStrategy,
  replayPendingOfflineMutations,
  dispatchMultiTabSyncEvent,
  performEmergencyUnloadSave,
  clearDeletedFileSessionResources,
  finalizeTabCloseEviction,
  executeSwitchTabDeactivate,
  executeRemoteContentUpdatedHelper,
  type OfflineMutationModel,
} from './session-offline-sync';

export { shouldUseRealtimePersistence };
export type {
  UnsyncedDocEdit,
  SyncedDocCacheEntry,
  DocumentSessionState,
  DocumentConflict,
  ConflictListener,
  DocumentPersistencePort,
};

export interface FlushResult {
  fileId: string;
  success: boolean;
  error?: unknown;
}

export interface FlushAllResult {
  total: number;
  succeeded: number;
  failed: number;
  results: FlushResult[];
}

export interface DocumentSessionOptions {
  persistenceAdapter?: DocumentPersistencePort;
  autoSaveDelay?: number;
  autoCompileDelay?: number;
  getProjectId?: () => string | undefined;
  isAutoCompileEnabled?: () => boolean;
}

const DEFAULT_AUTOSAVE_DELAY = 800; // ms
const DEFAULT_AUTOCOMPILE_DELAY = 1500; // ms (Overleaf parity)
const MAX_FSM_CONTEXTS = 200;
const STRUCTURAL_DIRECTIVE_REGEX =
  /\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/;

export class SessionCoordinator {
  private readonly customPersistenceAdapter?: DocumentPersistencePort;
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();
  private compileTimer: NodeJS.Timeout | null = null;
  private readonly dagDebounceTimers = new Map<string, NodeJS.Timeout>();
  private lastCompiledContentMap = new Map<string, string>();
  private isFlushingAll = false;
  private beforeUnloadInitialized = false;
  private readonly inFlightFileFlushes = new Map<string, Promise<boolean>>();

  private readonly fsmContexts = new Map<string, SessionFsmContext>();
  private readonly options: DocumentSessionOptions;
  private readonly realtimeConnected = new Map<string, boolean>();
  private readonly unsyncedEdits: UnsyncedEditsCoordinator;
  private readonly conflicts = new DocumentConflictCoordinator();
  private multiTabUnsubscriber: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(options: DocumentSessionOptions = {}) {
    this.options = options;
    this.customPersistenceAdapter = options.persistenceAdapter;
    this.unsyncedEdits = new UnsyncedEditsCoordinator((projectId) =>
      this.resolveEffectiveProjectId(projectId),
    );

    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
    this.initMultiTabSubscriptions();
  }

  private get persistenceAdapter(): DocumentPersistencePort {
    return this.customPersistenceAdapter ?? pagesService.docs;
  }

  private createPersistenceHost(): SessionPersistenceHost {
    return {
      persistenceAdapter: this.persistenceAdapter,
      unsyncedEdits: this.unsyncedEdits,
      conflicts: this.conflicts,
      autoSaveDelay: this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY,
      transitionFsm: (fileId, event) => {
        this.transitionFsm(fileId, event);
      },
      resolveEffectiveProjectId: (modelProjectId) =>
        this.resolveEffectiveProjectId(modelProjectId),
      isRealtimeConnected: (fileId) => this.isRealtimeConnected(fileId),
      scheduleAutoSave: (fileId, delayMs) => this.scheduleAutoSave(fileId, delayMs),
      saveUnsyncedEdit: (fileId, content, projectId) =>
        this.saveUnsyncedEdit(fileId, content, projectId),
      clearUnsyncedEdit: (fileId) => this.clearUnsyncedEdit(fileId),
      enqueueOfflineEdit: (fileId, model, opts) =>
        this.enqueueOfflineEdit(fileId, model, opts),
    };
  }

  public getFsmState(fileId: string): DocumentSessionState {
    return this.getOrCreateFsmContext(fileId).state;
  }

  private getOrCreateFsmContext(fileId: string): SessionFsmContext {
    let ctx = this.fsmContexts.get(fileId);
    if (!ctx) {
      if (this.fsmContexts.size >= MAX_FSM_CONTEXTS) {
        const oldestKey = this.fsmContexts.keys().next().value;
        if (oldestKey !== undefined) this.fsmContexts.delete(oldestKey);
      }
      const version = lruDocumentCache.getContentVersion(fileId) || 0;
      ctx = createInitialSessionContext(fileId, version);
      this.fsmContexts.set(fileId, ctx);
    }
    return ctx;
  }

  private transitionFsm(
    fileId: string,
    event: Parameters<typeof sessionFsmTransition>[1],
  ): SessionFsmContext {
    const ctx = this.getOrCreateFsmContext(fileId);
    const updated = sessionFsmTransition(ctx, event);
    this.fsmContexts.set(fileId, updated);
    return updated;
  }

  private resolveEffectiveProjectId(modelProjectId?: string): string {
    if (modelProjectId) return modelProjectId;
    if (this.options.getProjectId) {
      const p = this.options.getProjectId();
      if (p) return p;
    }
    const state = usePageStore.getState();
    return state.spaceId || state.projectId || 'workspace-local';
  }

  public setRealtimeConnected(fileId: string, connected: boolean): void {
    const previous = this.realtimeConnected.get(fileId);
    this.realtimeConnected.set(fileId, connected);
    if (previous === true && !connected) {
      const model = lruDocumentCache.getModel(fileId);
      if (model?.isDirty) {
        this.saveUnsyncedEdit(fileId, model.content, model.projectId);
        this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
      }
    }
  }

  public clearRealtimeStatus(fileId: string): void {
    this.realtimeConnected.delete(fileId);
  }

  public isRealtimeConnected(fileId: string): boolean {
    if (this.realtimeConnected.get(fileId) !== true) return false;
    const activeProvider = getActiveYjsProvider(fileId);
    if (activeProvider) {
      return activeProvider.status === 'connected' && activeProvider.isSynced;
    }
    return true;
  }

  public beginRecoveryDecision(fileId: string): void {
    this.unsyncedEdits.beginRecoveryDecision(fileId);
  }

  public endRecoveryDecision(fileId: string): void {
    this.unsyncedEdits.endRecoveryDecision(fileId);
  }

  public isRecoveryDecisionPending(fileId: string): boolean {
    return this.unsyncedEdits.isRecoveryDecisionPending(fileId);
  }

  public restoreUnsyncedEdit(fileId: string, content: string): void {
    this.endRecoveryDecision(fileId);
    lruDocumentCache.updateContent(fileId, content, true);
    this.notifyContentChange(fileId, content, {
      isRealtimeActive: this.isRealtimeConnected(fileId),
    });
  }

  public discardUnsyncedEdit(fileId: string): void {
    this.endRecoveryDecision(fileId);
    this.clearUnsyncedEdit(fileId);
  }

  public onConflict(listener: ConflictListener): () => void {
    return this.conflicts.onConflict(listener);
  }

  public getConflict(fileId: string): DocumentConflict | undefined {
    return this.conflicts.getConflict(fileId);
  }

  public getConflicts(): DocumentConflict[] {
    return this.conflicts.getConflicts();
  }

  public resolveConflict(
    fileId: string,
    resolution: 'keep-local' | 'take-remote' | 'custom-merge',
    mergedContent?: string,
  ): void {
    executeResolveConflictHelper({
      host: this.createPersistenceHost(),
      fileId,
      resolution,
      mergedContent,
      reindex: (fid, content) => this.reindex(fid, content),
    });
  }

  private reindex(fileId: string, content: string): void {
    const model = lruDocumentCache.getModel(fileId);
    const filePath = model?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);
    if (STRUCTURAL_DIRECTIVE_REGEX.test(content)) {
      latexDependencyGraph.parseAndRegister(filePath, content, fileId);
    }
  }

  public async handleOnline(): Promise<void> {
    const connStore = useConnectivityStore.getState();
    connStore.recordOnline();
    connStore.setIsSyncingOfflineQueue(true);
    try {
      await this.flushAllPending();
      await this.replayPendingMutations();
      if (useConnectivityStore.getState().offlinePendingCompile) {
        useConnectivityStore.getState().setOfflinePendingCompile(false);
        editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'external-trigger' });
      }
    } finally {
      useConnectivityStore.getState().setIsSyncingOfflineQueue(false);
    }
  }

  public handleOffline(): void {
    useConnectivityStore.getState().recordOffline();
    this.flushPendingUnsyncedEdits();
  }

  private initOnlineListener(): void {
    if (typeof window === 'undefined') return;
    this.disposeOnlineListener();
    this.onlineHandler = () => void this.handleOnline();
    this.offlineHandler = () => this.handleOffline();
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  public disposeOnlineListener(): void {
    if (typeof window === 'undefined') return;
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    this.onlineHandler = null;
    this.offlineHandler = null;
  }

  private initCommandSubscriptions(): void {
    editorCommandBus.subscribe('document:content-updated', (cmd) => {
      this.handleRemoteContentUpdated(cmd.docId, cmd.content);
    });
    editorCommandBus.subscribe('document:persisted', (cmd) => {
      handleDocumentPersisted(this.createPersistenceHost(), cmd);
    });
  }

  private initMultiTabSubscriptions(): void {
    this.multiTabUnsubscriber?.();
    this.multiTabUnsubscriber = multiTabBus.subscribe((event) => {
      dispatchMultiTabSyncEvent(event, (fileId, content) => this.reindex(fileId, content));
    });
  }

  public handleRemoteContentUpdated(fileId: string, remoteContent: string): void {
    executeRemoteContentUpdatedHelper({
      fileId,
      remoteContent,
      isRealtimeConnected: (fid) => this.isRealtimeConnected(fid),
      transitionRemoteEdit: (fid, v) => this.transitionFsm(fid, { type: 'REMOTE_EDIT', version: v }),
      transitionConflictDetected: (fid) => this.transitionFsm(fid, { type: 'CONFLICT_DETECTED' }),
      reindex: (fid, c) => this.reindex(fid, c),
      unsyncedEdits: this.unsyncedEdits,
      conflicts: this.conflicts,
    });
  }

  public recordOfflineEditConflict(
    fileId: string,
    localContent: string,
    remoteContent: string,
    options?: { projectId?: string; currentRev?: number },
  ): void {
    this.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });
    this.unsyncedEdits.flushNow(fileId, localContent, options?.projectId);
    this.conflicts.recordConflict(fileId, localContent, remoteContent, {
      currentRev: options?.currentRev,
      hasAuthoritativeRemote: true,
    });
  }

  private initVisibilityFlushHandler(): void {
    visibilityCoordinator.registerFlushHandler(async () => {
      this.flushPendingUnsyncedEdits();
      await this.flushAllPending();
    });
  }

  public initBeforeUnloadProtection(): () => void {
    if (typeof window === 'undefined' || this.beforeUnloadInitialized) return () => {};
    this.beforeUnloadInitialized = true;

    const handler = (e: BeforeUnloadEvent) => {
      if (performEmergencyUnloadSave((pid) => this.resolveEffectiveProjectId(pid))) {
        e.preventDefault();
        e.returnValue = '';
        this.flushPendingUnsyncedEdits();
        void this.flushAllPending();
        return '';
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      this.beforeUnloadInitialized = false;
    };
  }

  public notifyContentChange(
    fileId: string,
    content: string,
    options?: {
      isRealtimeActive?: boolean;
      customAutoSaveDelay?: number;
      skipAutoCompile?: boolean;
      hasStructuralChange?: boolean;
      origin?: 'local' | 'remote';
    },
  ): void {
    const isRealtime = options?.isRealtimeActive ?? this.isRealtimeConnected(fileId);
    const isRemote = options?.origin === 'remote';

    if (isRemote) {
      lruDocumentCache.applyRemoteContent(fileId, content);
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'REMOTE_EDIT', version: v });
    } else {
      if (isRealtime) lruDocumentCache.clearServerRev(fileId);
      lruDocumentCache.updateContent(fileId, content, true);
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'LOCAL_EDIT', version: v });
    }

    const currentModel = lruDocumentCache.getModel(fileId);
    const filePath = currentModel?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);

    const shouldCheckDag = options?.hasStructuralChange ?? true;
    if (shouldCheckDag && STRUCTURAL_DIRECTIVE_REGEX.test(content)) {
      const existingDagTimer = this.dagDebounceTimers.get(fileId);
      if (existingDagTimer) clearTimeout(existingDagTimer);
      this.dagDebounceTimers.set(
        fileId,
        setTimeout(() => {
          this.dagDebounceTimers.delete(fileId);
          latexDependencyGraph.parseAndRegister(filePath, content);
        }, 400),
      );
    }

    if (isRemote) {
      if (currentModel?.isDirty) {
        this.saveUnsyncedEdit(fileId, content, currentModel.projectId);
      }
      return;
    }

    const activeProjectId = this.resolveEffectiveProjectId(currentModel?.projectId);
    this.saveUnsyncedEdit(fileId, content, activeProjectId);

    if (!isRealtime) {
      this.scheduleAutoSave(
        fileId,
        options?.customAutoSaveDelay ?? this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY,
      );
    }

    if (!options?.skipAutoCompile) {
      this.scheduleAutoCompile(fileId);
    }
  }

  public async flushFile(fileId: string): Promise<boolean> {
    const existingFlush = this.inFlightFileFlushes.get(fileId);
    if (existingFlush) return existingFlush;

    const flushPromise = this.executeFlushFile(fileId).finally(() => {
      this.inFlightFileFlushes.delete(fileId);
    });
    this.inFlightFileFlushes.set(fileId, flushPromise);
    return flushPromise;
  }

  private async executeFlushFile(fileId: string): Promise<boolean> {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }

    const model = lruDocumentCache.getModel(fileId);
    if (!model || !model.isDirty) return true;

    const host = this.createPersistenceHost();
    const mode = this.selectFlushStrategyMode(fileId);
    if (mode === 'realtime-yjs') return flushViaRealtimeYjsStrategy(host, fileId, model.projectId);
    if (mode === 'offline-queue') return flushViaOfflineQueueStrategy(host, fileId, model);
    return flushViaRestCasStrategy(host, fileId, model);
  }

  public selectFlushStrategyMode(
    fileId: string,
  ): 'realtime-yjs' | 'offline-queue' | 'rest-cas' {
    if (this.isRealtimeConnected(fileId)) return 'realtime-yjs';
    if (!useConnectivityStore.getState().checkIsOnline()) return 'offline-queue';
    return 'rest-cas';
  }

  private enqueueOfflineEdit(
    fileId: string,
    model: OfflineMutationModel,
    options?: { flushImmediate?: boolean },
  ): void {
    enqueueOfflineEditHelper(
      {
        unsyncedEdits: this.unsyncedEdits,
        resolveEffectiveProjectId: (projectId) => this.resolveEffectiveProjectId(projectId),
      },
      fileId,
      model,
      options,
    );
  }

  public hasDirtyDocuments(): boolean {
    if (this.saveTimers.size > 0 || this.inFlightFileFlushes.size > 0) return true;
    return lruDocumentCache.getDirtyFileIds().length > 0;
  }

  public async flushDocument(fileId: string): Promise<boolean> {
    return this.flushFile(fileId);
  }

  public async flushAllPending(): Promise<FlushAllResult> {
    if (this.isFlushingAll) return { total: 0, succeeded: 0, failed: 0, results: [] };
    this.isFlushingAll = true;

    for (const timer of this.saveTimers.values()) clearTimeout(timer);
    this.saveTimers.clear();
    this.flushPendingUnsyncedEdits();

    const dirtyModels = lruDocumentCache.getDirtyModels();
    if (dirtyModels.length === 0) {
      this.isFlushingAll = false;
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }

    try {
      return await executeFlushAllDirtyModelsHelper({
        dirtyModels,
        flushFile: (fid) => this.flushFile(fid),
        enqueueOfflineEdit: (fid, model) => this.enqueueOfflineEdit(fid, model),
      });
    } finally {
      this.isFlushingAll = false;
    }
  }

  public async replayPendingMutations(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  }> {
    return replayPendingOfflineMutations(this.createPersistenceHost());
  }

  public flushPendingUnsyncedEdits(): void {
    this.unsyncedEdits.flushPending();
  }

  public saveUnsyncedEdit(fileId: string, content: string, projectId?: string): void {
    this.unsyncedEdits.scheduleSave(fileId, content, projectId);
  }

  public clearUnsyncedEdit(fileId: string): void {
    this.unsyncedEdits.clear(fileId);
  }

  public checkUnsyncedEditRecovery(
    fileId: string,
    serverContent: string,
  ): { hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit } {
    return this.unsyncedEdits.checkRecoverySync(fileId, serverContent);
  }

  public async checkUnsyncedEditRecoveryAsync(
    fileId: string,
    serverContent: string,
  ): Promise<{ hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit }> {
    return this.unsyncedEdits.checkRecoveryAsync(fileId, serverContent);
  }

  public switchTab(fromFileId: string | null, toFileId: string): void {
    executeSwitchTabDeactivate({
      fromFileId,
      toFileId,
      transitionDeactivate: (fid) => this.transitionFsm(fid, { type: 'DEACTIVATE' }),
      transitionActivate: (fid) => this.transitionFsm(fid, { type: 'ACTIVATE' }),
      saveUnsyncedEdit: (fid, c, pid) => this.saveUnsyncedEdit(fid, c, pid),
      flushPendingUnsyncedEdits: () => this.flushPendingUnsyncedEdits(),
    });
  }

  public cancelPendingAutoSave(fileId: string): boolean {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
      return true;
    }
    return false;
  }

  public resumeAutoSaveIfDirty(fileId: string): void {
    const model = lruDocumentCache.getModel(fileId);
    if (model?.isDirty) {
      this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
    }
  }

  public markRealtimeSynced(fileId: string, syncedContent?: string): void {
    this.cancelPendingAutoSave(fileId);
    const model = lruDocumentCache.getModel(fileId);
    if (!model) return;
    const expectedText = syncedContent ?? model.content;
    if (lruDocumentCache.markCleanIfUnchanged(fileId, expectedText)) {
      lruDocumentCache.markClean(fileId);
      clearWorkspaceTabDirty(fileId, model.projectId);
      this.clearUnsyncedEdit(fileId);
      const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, {
        type: 'SAVE_SUCCESS',
        savedVersion: currentVersion,
        currentVersion,
      });
      useConnectivityStore.getState().setLastSavedAt(new Date());
    }
  }

  public evictDeletedFile(fileId: string): void {
    this.cancelPendingAutoSave(fileId);
    const dagTimer = this.dagDebounceTimers.get(fileId);
    if (dagTimer) {
      clearTimeout(dagTimer);
      this.dagDebounceTimers.delete(fileId);
    }
    this.transitionFsm(fileId, { type: 'EVICT' });
    clearDeletedFileSessionResources({
      fileId,
      unsyncedEdits: this.unsyncedEdits,
      conflicts: this.conflicts,
      lastCompiledContentMap: this.lastCompiledContentMap,
      realtimeConnected: this.realtimeConnected,
      fsmContexts: this.fsmContexts,
      clearUnsyncedEdit: (fid) => this.clearUnsyncedEdit(fid),
    });
  }

  public closeTab(fileId: string): void {
    this.transitionFsm(fileId, { type: 'EVICT' });
    finalizeTabCloseEviction({
      fileId,
      hasInFlightFlush: this.inFlightFileFlushes.has(fileId),
      flushFile: (fid) => this.flushFile(fid),
      saveUnsyncedEdit: (fid, content, pid) => this.saveUnsyncedEdit(fid, content, pid),
      flushPendingUnsyncedEdits: () => this.flushPendingUnsyncedEdits(),
      unsyncedEdits: this.unsyncedEdits,
      conflicts: this.conflicts,
      lastCompiledContentMap: this.lastCompiledContentMap,
      realtimeConnected: this.realtimeConnected,
    });
  }

  public resetSession(): void {
    for (const timer of this.saveTimers.values()) clearTimeout(timer);
    this.saveTimers.clear();
    if (this.compileTimer) {
      clearTimeout(this.compileTimer);
      this.compileTimer = null;
    }
    for (const timer of this.dagDebounceTimers.values()) clearTimeout(timer);
    this.dagDebounceTimers.clear();
    this.fsmContexts.clear();
    this.lastCompiledContentMap.clear();
    this.realtimeConnected.clear();
    warmEditorStatePool.clear();
    this.unsyncedEdits.clearAll();
    this.conflicts.clearAll();
  }

  private scheduleAutoSave(fileId: string, delayMs: number): void {
    if (this.isRealtimeConnected(fileId)) return;
    const existing = this.saveTimers.get(fileId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.saveTimers.delete(fileId);
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => void this.flushFile(fileId), { timeout: 1000 });
      } else {
        void this.flushFile(fileId);
      }
    }, delayMs);

    this.saveTimers.set(fileId, timer);
  }

  private scheduleAutoCompile(fileId: string): void {
    const isAutoCompile = this.options.isAutoCompileEnabled
      ? this.options.isAutoCompileEnabled()
      : useSettingsStore.getState().autoCompile;
    if (!isAutoCompile) return;

    const currentContent = lruDocumentCache.getModel(fileId)?.content;
    const prevCompiled = this.lastCompiledContentMap.get(fileId);
    if (prevCompiled !== undefined && currentContent !== undefined && prevCompiled === currentContent) {
      return;
    }

    if (this.compileTimer) clearTimeout(this.compileTimer);

    this.compileTimer = setTimeout(() => {
      this.compileTimer = null;
      const model = lruDocumentCache.getModel(fileId);
      if (!model) return;
      if (model.content === this.lastCompiledContentMap.get(fileId)) return;
      this.lastCompiledContentMap.set(fileId, model.content);
      editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'auto' });
    }, this.options.autoCompileDelay ?? DEFAULT_AUTOCOMPILE_DELAY);
  }
}

export const sessionCoordinator = new SessionCoordinator();
