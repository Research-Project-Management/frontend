/**
 * session.coordinator.ts
 *
 * Unified Document Session Coordinator (Deep Module - Coordinators Layer):
 * Follows Matt Pocock's Codebase Design principles:
 * - Deep Module: A lot of behavior (FSM, autosave, offline sync, conflict resolution,
 *   crash resilience, debounced draft indexing) behind a concise interface.
 * - Real Seam: Injected DocumentPersistencePort with production & test stand-in support.
 * - Finite State Machine: Tracks document session lifecycle to prevent race conditions.
 * - Single source of truth for in-memory & persisted document state.
 */

import {
  lruDocumentCache,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  draftStorageService,
  type DraftSnapshot,
  type ProjectFileSnapshot,
} from '@/features/editor/domain/document/draft-storage';
import {
  createInitialSessionContext,
  sessionFsmTransition,
  type DocumentSessionState,
  type SessionFsmContext,
} from '@/features/editor/domain/document/session-fsm';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import {
  markHttpSavedWhileDisconnected,
  flushYjsProvider,
} from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import {
  usePageStore,
  useSettingsStore,
  useConnectivityStore,
  isNetworkError,
  editorCommandBus,
  getActiveEditorEngine,
  getEditorEngineForFile,
  getAllRegisteredEngines,
  getActiveEditorContent,
} from '@/features/editor/core';
import { visibilityCoordinator } from './visibility.coordinator';
import {
  DraftRecoveryCoordinator,
  type DocumentConflict,
  type ConflictListener,
} from './draft-recovery.coordinator';

export type {
  DraftSnapshot,
  ProjectFileSnapshot,
  DocumentSessionState,
  DocumentConflict,
  ConflictListener,
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

/**
 * Pure policy: HTTP autosave is required unless a realtime CRDT channel is actually connected.
 */
export function shouldUseRealtimePersistence(input: {
  hasYText: boolean;
  isOnline: boolean;
  isProviderConnected: boolean;
}): boolean {
  return input.hasYText && input.isOnline && input.isProviderConnected;
}

export interface DocumentPersistencePort {
  updateContent(
    fileId: string,
    content: string,
    options?: { expectedRev?: number; expectedVersion?: number }
  ): Promise<unknown>;
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

export class SessionCoordinatorRegistry {
  private readonly persistenceAdapter: DocumentPersistencePort;
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();
  private compileTimer: NodeJS.Timeout | null = null;
  private readonly dagDebounceTimers = new Map<string, NodeJS.Timeout>();
  private lastCompiledContentMap = new Map<string, string>();
  private isFlushingAll = false;
  private beforeUnloadInitialized = false;
  private readonly inFlightFileFlushes = new Map<string, Promise<boolean>>();

  /** Per-document Finite State Machine contexts */
  private readonly fsmContexts = new Map<string, SessionFsmContext>();

  /** Custom options / dependency hooks */
  private readonly options: DocumentSessionOptions;

  /** Per-file realtime (Yjs socket) connection status reported by the editor UI. */
  private readonly realtimeConnected = new Map<string, boolean>();
  /** Draft recovery & conflict sub-coordinator */
  private readonly draftRecovery: DraftRecoveryCoordinator;

  constructor(options: DocumentSessionOptions = {}) {
    this.options = options;
    this.persistenceAdapter = options.persistenceAdapter ?? manuscriptService.docs;
    this.draftRecovery = new DraftRecoveryCoordinator((projectId) =>
      this.resolveEffectiveProjectId(projectId)
    );

    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
  }

  public getFsmState(fileId: string): DocumentSessionState {
    return this.getOrCreateFsmContext(fileId).state;
  }

  private getOrCreateFsmContext(fileId: string): SessionFsmContext {
    let ctx = this.fsmContexts.get(fileId);
    if (!ctx) {
      if (this.fsmContexts.size >= MAX_FSM_CONTEXTS) {
        const oldestKey = this.fsmContexts.keys().next().value;
        if (oldestKey !== undefined) {
          this.fsmContexts.delete(oldestKey);
        }
      }
      const version = lruDocumentCache.getContentVersion(fileId) || 0;
      ctx = createInitialSessionContext(fileId, version);
      this.fsmContexts.set(fileId, ctx);
    }
    return ctx;
  }

  private transitionFsm(
    fileId: string,
    event: Parameters<typeof sessionFsmTransition>[1]
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
    return usePageStore.getState().projectId || 'workspace-local';
  }

  // ── Realtime connection status ─────────────────────────────────────────────

  /**
   * Reports the actual realtime (Yjs socket) connection status for a file.
   * On a connected -> disconnected transition, dirty content is immediately
   * protected via draft snapshot + HTTP autosave since the CRDT channel is gone.
   */
  public setRealtimeConnected(fileId: string, connected: boolean): void {
    const previous = this.realtimeConnected.get(fileId);
    this.realtimeConnected.set(fileId, connected);
    if (previous === true && !connected) {
      const model = lruDocumentCache.getModel(fileId);
      if (model?.isDirty) {
        this.saveDraftSnapshot(fileId, model.content, model.projectId);
        this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
      }
    }
  }

  public clearRealtimeStatus(fileId: string): void {
    this.realtimeConnected.delete(fileId);
  }

  public isRealtimeConnected(fileId: string): boolean {
    return this.realtimeConnected.get(fileId) === true;
  }

  // ── Draft recovery decision gate ───────────────────────────────────────────

  public beginDraftDecision(fileId: string): void {
    this.draftRecovery.beginDraftDecision(fileId);
  }

  public endDraftDecision(fileId: string): void {
    this.draftRecovery.endDraftDecision(fileId);
  }

  public isDraftDecisionPending(fileId: string): boolean {
    return this.draftRecovery.isDraftDecisionPending(fileId);
  }

  public restoreDraft(fileId: string, content: string): void {
    this.endDraftDecision(fileId);
    lruDocumentCache.updateContent(fileId, content, true);
    this.notifyContentChange(fileId, content, {
      isRealtimeActive: this.isRealtimeConnected(fileId),
    });
  }

  public discardDraft(fileId: string): void {
    this.endDraftDecision(fileId);
    this.clearDraftSnapshot(fileId);
  }

  // ── Conflict surfacing ─────────────────────────────────────────────────────

  public onConflict(listener: ConflictListener): () => void {
    return this.draftRecovery.onConflict(listener);
  }

  public getConflict(fileId: string): DocumentConflict | undefined {
    return this.draftRecovery.getConflict(fileId);
  }

  public getConflicts(): DocumentConflict[] {
    return this.draftRecovery.getConflicts();
  }

  /**
   * Resolves a surfaced conflict.
   * - 'keep-local': local edits stay dirty and will be saved, overwriting the remote version.
   * - 'take-remote': local content is replaced by the remote version (local copy kept as draft).
   * - 'custom-merge': custom merged content replaces local & remote (local copy kept as draft) and is scheduled for save.
   */
  public resolveConflict(
    fileId: string,
    resolution: 'keep-local' | 'take-remote' | 'custom-merge',
    mergedContent?: string
  ): void {
    const conflict = this.draftRecovery.takeConflict(fileId);
    if (!conflict) return;

    this.transitionFsm(fileId, { type: 'CONFLICT_RESOLVED', resolution });

    if (resolution === 'take-remote') {
      // Preserve the local version as a recoverable draft before replacing it.
      this.draftRecovery.flushDraftNow(fileId, conflict.localContent, lruDocumentCache.getModel(fileId)?.projectId);
      lruDocumentCache.updateContent(fileId, conflict.remoteContent, false);
      lruDocumentCache.markClean(fileId);
      useCompileStore.getState().clearDirty(fileId);
      this.reindex(fileId, conflict.remoteContent);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: conflict.remoteContent, fileId });
    } else if (resolution === 'custom-merge' && typeof mergedContent === 'string') {
      // Preserve the local version as a recoverable draft before applying custom merge
      this.draftRecovery.flushDraftNow(fileId, conflict.localContent, lruDocumentCache.getModel(fileId)?.projectId);
      lruDocumentCache.updateContent(fileId, mergedContent, true);
      useCompileStore.getState().markDirty(fileId, mergedContent);
      this.reindex(fileId, mergedContent);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: mergedContent, fileId });
      this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
    } else {
      this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
    }
  }

  private reindex(fileId: string, content: string): void {
    const model = lruDocumentCache.getModel(fileId);
    const filePath = model?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);
    if (/\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(content)) {
      latexDagEngine.parseAndRegister(filePath, content, fileId);
    }
  }

  /**
   * Common post-save bookkeeping. Only marks the model clean / clears drafts if the
   * content sent to the server is still the current local content; otherwise the newer
   * edits remain dirty and another save is scheduled.
   * Returns true when the file is fully clean.
   */
  private async finalizeSuccessfulSave(
    fileId: string,
    sentContent: string,
    sentVersion?: number
  ): Promise<boolean> {
    markHttpSavedWhileDisconnected(fileId);

    const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
    this.transitionFsm(fileId, {
      type: 'SAVE_SUCCESS',
      savedVersion: sentVersion ?? currentVersion,
      currentVersion,
    });

    const model = lruDocumentCache.getModel(fileId);
    if (!model) {
      // No live model: clear the stored draft only if it is exactly what we saved.
      const draft = await draftStorageService.getDraft(fileId).catch(() => null);
      if (!draft || draft.content === sentContent) {
        useCompileStore.getState().clearDirty(fileId);
        this.clearDraftSnapshot(fileId);
        return true;
      }
      return false;
    }
    if (lruDocumentCache.markCleanIfUnchanged(fileId, sentContent, sentVersion)) {
      useCompileStore.getState().clearDirty(fileId);
      this.clearDraftSnapshot(fileId);
      return true;
    }
    // Content changed while the request was in flight: keep dirty & re-save.
    if (!this.isRealtimeConnected(fileId)) {
      this.scheduleAutoSave(fileId, this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
    }
    return false;
  }

  public async handleOnline(): Promise<void> {
    useConnectivityStore.getState().recordOnline();
    await this.flushAllPending();
    await this.replayPendingMutations();
    if (useConnectivityStore.getState().offlinePendingCompile) {
      useConnectivityStore.getState().setOfflinePendingCompile(false);
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
    }
  }

  public handleOffline(): void {
    useConnectivityStore.getState().recordOffline();
    this.flushPendingDrafts();
  }

  private initOnlineListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      void this.handleOnline();
    });
    window.addEventListener('offline', () => {
      this.handleOffline();
    });
  }

  private initCommandSubscriptions(): void {
    editorCommandBus.subscribe('document:content-updated', (cmd) => {
      this.handleRemoteContentUpdated(cmd.docId, cmd.content);
    });
  }

  /**
   * Handles a remote full-content update (server broadcast). Never silently drops data:
   * - local clean  -> apply remote content.
   * - local dirty & identical -> nothing to do.
   * - local dirty & realtime CRDT connected -> Yjs merges both sides; nothing is lost.
   * - local dirty & no realtime -> surface a conflict to listeners for user resolution.
   */
  public handleRemoteContentUpdated(fileId: string, remoteContent: string): void {
    const model = lruDocumentCache.getModel(fileId);
    if (!model?.isDirty) {
      lruDocumentCache.updateContent(fileId, remoteContent, false);
      lruDocumentCache.markClean(fileId);
      useCompileStore.getState().clearDirty(fileId);
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'REMOTE_EDIT', version: v });
      this.reindex(fileId, remoteContent);
      return;
    }
    if (model.content === remoteContent) {
      this.draftRecovery.clearConflict(fileId);
      return;
    }
    if (this.isRealtimeConnected(fileId)) {
      return;
    }

    this.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });
    this.draftRecovery.recordConflict(fileId, model.content, remoteContent, model.projectId);
  }

  private initVisibilityFlushHandler(): void {
    visibilityCoordinator.registerFlushHandler(async () => {
      this.flushPendingDrafts();
      await this.flushAllPending();
    });
  }

  public initBeforeUnloadProtection(): () => void {
    if (typeof window === 'undefined' || this.beforeUnloadInitialized) {
      return () => {};
    }
    this.beforeUnloadInitialized = true;

    const handler = (e: BeforeUnloadEvent) => {
      const dirtyModels = lruDocumentCache.getDirtyModels();
      if (dirtyModels.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        this.flushPendingDrafts();
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
    }
  ): void {
    const isRealtime = options?.isRealtimeActive ?? this.isRealtimeConnected(fileId);
    const isRemote = options?.origin === 'remote';

    // 1. In-memory hot RAM update (0ms latency). Remote changes never set — nor clear — the
    //    local dirty flag (clearing it would drop unsaved local edits from persistence).
    if (isRemote) {
      lruDocumentCache.applyRemoteContent(fileId, content);
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'REMOTE_EDIT', version: v });
    } else {
      lruDocumentCache.updateContent(fileId, content, true);
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'LOCAL_EDIT', version: v });
    }

    // 1b. Incrementally update Cross-file LaTeX symbols (Offloaded to Web Worker)
    const currentModel = lruDocumentCache.getModel(fileId);
    const filePath = currentModel?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);

    // Fast guard: debounced re-parsing of DAG graph if file contains structural include/class directives.
    const shouldCheckDag = options?.hasStructuralChange ?? true;
    if (shouldCheckDag && /\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(content)) {
      const existingDagTimer = this.dagDebounceTimers.get(fileId);
      if (existingDagTimer) clearTimeout(existingDagTimer);
      this.dagDebounceTimers.set(
        fileId,
        setTimeout(() => {
          this.dagDebounceTimers.delete(fileId);
          latexDagEngine.parseAndRegister(filePath, content);
        }, 400),
      );
    }

    if (isRemote) {
      if (currentModel?.isDirty) {
        this.saveDraftSnapshot(fileId, content, currentModel.projectId);
      }
      return;
    }

    // 2. Mark dirty in compile store for immediate incremental compilation inclusion
    useCompileStore.getState().markDirty(fileId, content);

    // 3. Local crash resilience backup (Tier 2 persistence)
    const activeProjectId = this.resolveEffectiveProjectId(currentModel?.projectId);
    this.saveDraftSnapshot(fileId, content, activeProjectId);

    // 4. Schedule debounced auto-save to backend
    if (!isRealtime) {
      this.scheduleAutoSave(fileId, options?.customAutoSaveDelay ?? this.options.autoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
    }

    // 5. Schedule debounced auto-compile if enabled in user settings
    if (!options?.skipAutoCompile) {
      this.scheduleAutoCompile(fileId);
    }
  }

  private isTransientSaveError(err: unknown): boolean {
    const status = (err as { status?: number })?.status;
    if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    if (status !== undefined) {
      return false;
    }
    return (
      err instanceof Error &&
      /timeout|timed out|too many requests|bad gateway|service unavailable|gateway timeout/i.test(
        err.message
      )
    );
  }

  private async persistWithRetry(
    fileId: string,
    sentContent: string,
    expectedRev?: number
  ): Promise<unknown> {
    const maxAttempts = 3;
    const baseDelayMs = 300;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res =
          expectedRev !== undefined
            ? await this.persistenceAdapter.updateContent(fileId, sentContent, { expectedRev })
            : await this.persistenceAdapter.updateContent(fileId, sentContent);
        if (res && typeof res === 'object') {
          const r = res as { rev?: number; updatedAt?: string };
          if (r.rev !== undefined || r.updatedAt !== undefined) {
            lruDocumentCache.updateServerVersion(fileId, {
              rev: r.rev,
              updatedAt: r.updatedAt,
            });
          }
        }
        return res;
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        if (status === 409 || attempt >= maxAttempts || !this.isTransientSaveError(err)) {
          throw err;
        }
        const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
      }
    }

    throw lastError;
  }

  private handleSaveConflictOrError(
    fileId: string,
    sentContent: string,
    err: unknown
  ): void {
    const model = lruDocumentCache.getModel(fileId);
    const status = (err as { status?: number })?.status;
    const isConflict =
      status === 409 ||
      (err as { code?: string })?.code === 'CONFLICT' ||
      (err instanceof Error && /\b409\b|conflict/i.test(err.message));

    if (isConflict) {
      this.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });
      const details = (err as { details?: Record<string, unknown> })?.details;
      const remoteRev =
        typeof details?.rev === 'number'
          ? details.rev
          : typeof details?.version === 'number'
            ? details.version
            : typeof details?.remoteRev === 'number'
              ? details.remoteRev
              : undefined;
      if (remoteRev !== undefined) {
        lruDocumentCache.updateServerVersion(fileId, { rev: remoteRev });
      }
      const remoteContent =
        typeof details?.remoteContent === 'string'
          ? details.remoteContent
          : typeof details?.content === 'string'
            ? details.content
            : '';
      const localContent = model?.content ?? sentContent;
      this.draftRecovery.recordConflict(fileId, localContent, remoteContent, model?.projectId);
      useConnectivityStore.getState().setSyncStatus('error');
      return;
    }

    this.transitionFsm(fileId, { type: 'SAVE_FAILURE', error: err });
    if (isNetworkError(err) && model) {
      useConnectivityStore.getState().recordOffline();
      this.draftRecovery.persistOfflineDraft(model.projectId, fileId, model.content, model.filePath);
    } else {
      useConnectivityStore.getState().setSyncStatus('error');
    }
  }

  public async flushFile(fileId: string): Promise<boolean> {
    const existingFlush = this.inFlightFileFlushes.get(fileId);
    if (existingFlush) {
      return existingFlush;
    }

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
    if (!model || !model.isDirty) {
      return true;
    }

    if (this.isRealtimeConnected(fileId)) {
      const effectiveProjectId = this.resolveEffectiveProjectId(model.projectId);
      flushYjsProvider(effectiveProjectId, fileId);
      lruDocumentCache.markSaved(fileId);
      useCompileStore.getState().clearDirty(fileId);
      this.clearDraftSnapshot(fileId);
      const currentVersion = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, {
        type: 'SAVE_SUCCESS',
        savedVersion: currentVersion,
        currentVersion,
      });
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return true;
    }

    const isOnline = useConnectivityStore.getState().checkIsOnline();
    if (!isOnline) {
      useConnectivityStore.getState().setSyncStatus('offline');
      this.draftRecovery.persistOfflineDraft(model.projectId, fileId, model.content, model.filePath);
      void draftStorageService.enqueueMutation({
        fileId,
        projectId: model.projectId,
        type: 'update_content',
        payload: { content: model.content },
      });
      void draftStorageService.saveProjectFileSnapshot({
        id: fileId,
        projectId: model.projectId || '',
        title: model.filePath || fileId,
        content: model.content,
        updatedAt: Date.now(),
      });
      return false;
    }

    // Transition FSM to SAVING
    this.transitionFsm(fileId, { type: 'SAVE_START' });

    // Snapshot what is being sent: the live model may change while the request is in flight.
    const sentContent = model.content;
    const sentVersion = lruDocumentCache.getContentVersion(fileId);
    const expectedRev = model.serverRev;
    try {
      useConnectivityStore.getState().incrementPending();
      await this.persistWithRetry(fileId, sentContent, expectedRev);
      const clean = await this.finalizeSuccessfulSave(fileId, sentContent, sentVersion);
      useConnectivityStore.getState().decrementPending();
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return clean;
    } catch (err) {
      useConnectivityStore.getState().decrementPending();
      this.handleSaveConflictOrError(fileId, sentContent, err);
      console.error(`[SessionCoordinator] Failed to flush file ${fileId}:`, err);
      return false;
    }
  }

  public async flushDocument(fileId: string): Promise<boolean> {
    return this.flushFile(fileId);
  }

  public async flushAllPending(): Promise<FlushAllResult> {
    if (this.isFlushingAll) {
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }
    this.isFlushingAll = true;

    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
    this.flushPendingDrafts();

    const dirtyModels = lruDocumentCache.getDirtyModels();
    const isOnline = useConnectivityStore.getState().checkIsOnline();

    if (!isOnline) {
      useConnectivityStore.getState().setSyncStatus('offline');
      for (const model of dirtyModels) {
        this.draftRecovery.persistOfflineDraft(model.projectId, model.fileId, model.content, model.filePath);
      }
      this.isFlushingAll = false;
      return { total: dirtyModels.length, succeeded: 0, failed: 0, results: [] };
    }

    const results: FlushResult[] = [];
    let succeeded = 0;
    let failed = 0;

    const flushPromises = dirtyModels.map(async (model) => {
      try {
        const ok = await this.flushFile(model.fileId);
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
    this.isFlushingAll = false;

    return { total: dirtyModels.length, succeeded, failed, results };
  }

  public async replayPendingMutations(): Promise<{ total: number; succeeded: number; failed: number }> {
    const pending = await draftStorageService.getPendingMutations();
    let succeeded = 0;
    let failed = 0;

    for (const mut of pending) {
      if (mut.type === 'update_content' && mut.payload.content !== undefined) {
        try {
          if (this.persistenceAdapter?.updateContent) {
            await this.persistenceAdapter.updateContent(mut.fileId, mut.payload.content as string);
          } else {
            await manuscriptService.docs.updateContent(mut.fileId, mut.payload.content as string);
          }
          if (mut.id) {
            await draftStorageService.removeMutation(mut.id);
          }
          await draftStorageService.clearDraft(mut.fileId);
          succeeded++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (mut.id) {
            await draftStorageService.updateMutationStatus(mut.id, 'failed', errMsg);
          }
          failed++;
        }
      }
    }

    if (succeeded > 0 && failed === 0) {
      useConnectivityStore.getState().setSyncStatus('synced');
      useConnectivityStore.getState().setLastSavedAt(new Date());
    }

    return { total: pending.length, succeeded, failed };
  }

  public flushPendingDrafts(): void {
    this.draftRecovery.flushPendingDrafts();
  }

  public saveDraftSnapshot(fileId: string, content: string, projectId?: string): void {
    this.draftRecovery.saveDraftSnapshot(fileId, content, projectId);
  }

  public clearDraftSnapshot(fileId: string): void {
    this.draftRecovery.clearDraftSnapshot(fileId);
  }

  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    return this.draftRecovery.checkDraftRecovery(fileId, serverContent);
  }

  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    return this.draftRecovery.checkDraftRecoveryAsync(fileId, serverContent);
  }

  public switchTab(fromFileId: string | null, toFileId: string): void {
    if (fromFileId && fromFileId !== toFileId) {
      // Synchronize uncommitted editor keystrokes for the specific outgoing fileId (Split-Pane safe)
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

      this.transitionFsm(fromFileId, { type: 'DEACTIVATE' });
      const updatedFromModel = lruDocumentCache.getModel(fromFileId);
      if (updatedFromModel && updatedFromModel.isDirty) {
        this.saveDraftSnapshot(fromFileId, updatedFromModel.content, updatedFromModel.projectId);
        this.flushPendingDrafts();
      }
    }
    this.transitionFsm(toFileId, { type: 'ACTIVATE' });
    lruDocumentCache.setActiveFileId(toFileId);
  }

  public evictDeletedFile(fileId: string): void {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }
    const dagTimer = this.dagDebounceTimers.get(fileId);
    if (dagTimer) {
      clearTimeout(dagTimer);
      this.dagDebounceTimers.delete(fileId);
    }
    this.transitionFsm(fileId, { type: 'EVICT' });
    this.fsmContexts.delete(fileId);
    lruDocumentCache.markClean(fileId);
    lruDocumentCache.evictModel(fileId);
    useCompileStore.getState().clearDirty(fileId);
    this.clearDraftSnapshot(fileId);
    this.lastCompiledContentMap.delete(fileId);
    this.realtimeConnected.delete(fileId);
    this.draftRecovery.evictFile(fileId);
  }

  public closeTab(fileId: string): void {
    this.transitionFsm(fileId, { type: 'EVICT' });
    const model = lruDocumentCache.getModel(fileId);
    if (model?.isDirty) {
      this.saveDraftSnapshot(fileId, model.content, model.projectId);
      this.flushPendingDrafts();
    }
    void this.flushFile(fileId);
    lruDocumentCache.evictModel(fileId);
    this.lastCompiledContentMap.delete(fileId);
    this.realtimeConnected.delete(fileId);
    this.draftRecovery.evictFile(fileId);
  }

  public resetSession(): void {
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
    if (this.compileTimer) {
      clearTimeout(this.compileTimer);
      this.compileTimer = null;
    }
    for (const timer of this.dagDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.dagDebounceTimers.clear();
    this.fsmContexts.clear();
    this.lastCompiledContentMap.clear();
    this.realtimeConnected.clear();
    this.draftRecovery.clearAll();
  }

  private scheduleAutoSave(fileId: string, delayMs: number): void {
    if (this.isRealtimeConnected(fileId)) {
      return;
    }
    const existing = this.saveTimers.get(fileId);
    if (existing) {
      clearTimeout(existing);
    }

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

    if (this.compileTimer) {
      clearTimeout(this.compileTimer);
    }

    this.compileTimer = setTimeout(() => {
      this.compileTimer = null;
      const model = lruDocumentCache.getModel(fileId);
      if (!model) return;

      const lastCompiled = this.lastCompiledContentMap.get(fileId);
      if (model.content === lastCompiled) return;

      this.lastCompiledContentMap.set(fileId, model.content);
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
    }, this.options.autoCompileDelay ?? DEFAULT_AUTOCOMPILE_DELAY);
  }
}

export const sessionCoordinator = new SessionCoordinatorRegistry();
