/**
 * session.coordinator.ts
 *
 * Unified Document Session Coordinator:
 * - Finite State Machine tracking document lifecycle (autosave, realtime Yjs, OCC conflicts).
 * - Server-authoritative with hot RAM LRU cache (zero offline shadow DB).
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  createInitialSessionContext,
  sessionFsmTransition,
  type DocumentSessionState,
  type SessionFsmContext,
} from '@/features/editor/domain/document/session-fsm';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { getIsOnline } from '@/shared/lib/network';
import { editorCommandBus } from '../bus/command-bus';
import { visibilityCoordinator } from './visibility.coordinator';
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
  clearDeletedFileSessionResources,
  finalizeTabCloseEviction,
  executeSwitchTabDeactivate,
  executeRemoteContentUpdatedHelper,
  type DocumentPersistencePort,
  type SessionPersistenceHost,
} from './session-persistence.strategy';

export { shouldUseRealtimePersistence };
export type {
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
const DEFAULT_AUTOCOMPILE_DELAY = 1500; // ms
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
  private readonly conflicts = new DocumentConflictCoordinator();

  constructor(options: DocumentSessionOptions = {}) {
    this.options = options;
    this.customPersistenceAdapter = options.persistenceAdapter;

    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
  }

  private get persistenceAdapter(): DocumentPersistencePort {
    return this.customPersistenceAdapter ?? pagesService.docs;
  }

  private createPersistenceHost(): SessionPersistenceHost {
    return {
      persistenceAdapter: this.persistenceAdapter,
      conflicts: this.conflicts,
      autoSaveDelay: this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY,
      transitionFsm: (fileId, event) => {
        this.transitionFsm(fileId, event);
      },
      resolveEffectiveProjectId: (modelProjectId) =>
        this.resolveEffectiveProjectId(modelProjectId),
      isRealtimeConnected: (fileId) => this.isRealtimeConnected(fileId),
      scheduleAutoSave: (fileId, delayMs) => this.scheduleAutoSave(fileId, delayMs),
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
        if (oldestKey) this.fsmContexts.delete(oldestKey);
      }
      ctx = createInitialSessionContext(fileId);
      this.fsmContexts.set(fileId, ctx);
    }
    return ctx;
  }

  private transitionFsm(
    fileId: string,
    event: Parameters<typeof sessionFsmTransition>[1],
  ): SessionFsmContext {
    const prev = this.getOrCreateFsmContext(fileId);
    const next = sessionFsmTransition(prev, event);
    this.fsmContexts.set(fileId, next);
    return next;
  }

  private resolveEffectiveProjectId(modelProjectId?: string): string {
    if (modelProjectId && modelProjectId.trim()) return modelProjectId;
    const fromOpt = this.options.getProjectId?.();
    if (fromOpt && fromOpt.trim()) return fromOpt;
    const ps = usePageStore.getState();
    return ps.spaceId || ps.projectId || ps.rootPageId || '';
  }

  public setRealtimeConnected(fileId: string, connected: boolean): void {
    this.realtimeConnected.set(fileId, connected);
    if (connected) {
      this.cancelPendingAutoSave(fileId);
    } else {
      this.resumeAutoSaveIfDirty(fileId);
    }
  }

  public isRealtimeConnected(fileId: string): boolean {
    const model = lruDocumentCache.getModel(fileId);
    const projectId = this.resolveEffectiveProjectId(model?.projectId);
    const provider = getActiveYjsProvider(fileId, projectId || undefined);
    const providerConnected = Boolean(
      this.realtimeConnected.get(fileId) || (provider && !provider.isDestroyed && provider.isSynced),
    );
    const providerSynced = provider ? provider.isSynced : true;
    return shouldUseRealtimePersistence({
      hasYText: Boolean(model?.yText),
      isOnline: getIsOnline(),
      isProviderConnected: providerConnected,
      isProviderSynced: providerSynced,
    });
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

  private initCommandSubscriptions(): void {
    editorCommandBus.subscribe('document:content-updated', (cmd) => {
      this.handleRemoteContentUpdated(cmd.docId, cmd.content);
    });
    editorCommandBus.subscribe('document:persisted', (cmd) => {
      handleDocumentPersisted(this.createPersistenceHost(), cmd);
    });
  }

  public handleRemoteContentUpdated(fileId: string, remoteContent: string): void {
    executeRemoteContentUpdatedHelper({
      fileId,
      remoteContent,
      isRealtimeConnected: (fid) => this.isRealtimeConnected(fid),
      transitionRemoteEdit: (fid, v) =>
        this.transitionFsm(fid, { type: 'REMOTE_EDIT', version: v }),
      transitionConflictDetected: (fid) =>
        this.transitionFsm(fid, { type: 'CONFLICT_DETECTED' }),
      reindex: (fid, c) => this.reindex(fid, c),
      conflicts: this.conflicts,
    });
  }

  private initVisibilityFlushHandler(): void {
    visibilityCoordinator.registerFlushHandler(async () => {
      await this.flushAllPending();
    });
  }

  public initBeforeUnloadProtection(): () => void {
    if (typeof window === 'undefined' || this.beforeUnloadInitialized) return () => {};
    this.beforeUnloadInitialized = true;

    const handler = (e: BeforeUnloadEvent) => {
      if (this.hasDirtyDocuments()) {
        e.preventDefault();
        e.returnValue = '';
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

    if (isRemote) return;

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
    if (this.isRealtimeConnected(fileId)) {
      return flushViaRealtimeYjsStrategy(host, fileId, model.projectId);
    }
    return flushViaRestCasStrategy(host, fileId, model);
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

    const dirtyModels = lruDocumentCache.getDirtyModels();
    if (dirtyModels.length === 0) {
      this.isFlushingAll = false;
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }

    try {
      return await executeFlushAllDirtyModelsHelper({
        dirtyModels,
        flushFile: (fid) => this.flushFile(fid),
      });
    } finally {
      this.isFlushingAll = false;
    }
  }

  /**
   * Deep flush barrier before any server-side read/mutation (search, replace-all, zip export).
   * Hides the 2-tier persistence ordering constraint (client dirty buffers -> backend updater flush).
   */
  public async syncBeforeServerRead(spaceOrPageId?: string | null): Promise<void> {
    if (!this.hasDirtyDocuments()) return;
    const flushRes = await this.flushAllPending().catch(() => null);
    if (spaceOrPageId && (!flushRes || flushRes.total > 0)) {
      await pagesService.updater.flushProject(spaceOrPageId).catch(() => null);
    }
  }

  public switchTab(fromFileId: string | null, toFileId: string): void {
    executeSwitchTabDeactivate({
      fromFileId,
      toFileId,
      transitionDeactivate: (fid) => this.transitionFsm(fid, { type: 'DEACTIVATE' }),
      transitionActivate: (fid) => this.transitionFsm(fid, { type: 'ACTIVATE' }),
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
      const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, {
        type: 'SAVE_SUCCESS',
        savedVersion: currentVersion,
        currentVersion,
      });
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
      conflicts: this.conflicts,
      lastCompiledContentMap: this.lastCompiledContentMap,
      realtimeConnected: this.realtimeConnected,
      fsmContexts: this.fsmContexts,
    });
  }

  public closeTab(fileId: string): void {
    this.transitionFsm(fileId, { type: 'EVICT' });
    finalizeTabCloseEviction({
      fileId,
      hasInFlightFlush: this.inFlightFileFlushes.has(fileId),
      flushFile: (fid) => this.flushFile(fid),
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
    if (
      prevCompiled !== undefined &&
      currentContent !== undefined &&
      prevCompiled === currentContent
    ) {
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
