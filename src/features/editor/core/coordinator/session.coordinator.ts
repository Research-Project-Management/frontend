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

import { documentStore } from '@/features/editor/domain/document/document-store';
import {
  lruDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  draftStorageService,
  type DraftSnapshot,
  type ProjectFileSnapshot,
  type OfflineMutation,
} from '@/features/editor/domain/document/draft-storage';
import {
  createInitialSessionContext,
  sessionFsmTransition,
  type DocumentSessionState,
  type SessionFsmContext,
} from '@/features/editor/domain/document/session-fsm';
import type { DocumentPersistencePort } from '@/features/editor/domain/document/persistence-port';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { markHttpSavedWhileDisconnected } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import {
  usePageStore,
  useSettingsStore,
  useConnectivityStore,
  editorCommandBus,
  getActiveEditorEngine,
  getActiveEditorContent,
} from '@/features/editor/core';
import { visibilityCoordinator } from './visibility.coordinator';

export type { DraftSnapshot, ProjectFileSnapshot, OfflineMutation, DocumentSessionState };

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

export interface DocumentConflict {
  fileId: string;
  localContent: string;
  remoteContent: string;
  detectedAt: number;
}

export type ConflictListener = (conflict: DocumentConflict) => void;

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

export interface DocumentSessionOptions {
  autoSaveDelay?: number;
  autoCompileDelay?: number;
  persistenceAdapter?: DocumentPersistencePort;
  getProjectId?: () => string | undefined;
  isAutoCompileEnabled?: () => boolean;
}

const DEFAULT_AUTOSAVE_DELAY = 800; // ms
const DEFAULT_AUTOCOMPILE_DELAY = 1500; // ms (Overleaf parity)

export class SessionCoordinatorRegistry {
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();
  private readonly draftTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingDrafts = new Map<string, { content: string; projectId?: string }>();
  private compileTimer: NodeJS.Timeout | null = null;
  private lastCompiledContentMap = new Map<string, string>();
  private isFlushingAll = false;
  private isReplayingMutations = false;
  private beforeUnloadInitialized = false;

  /** Per-document Finite State Machine contexts */
  private readonly fsmContexts = new Map<string, SessionFsmContext>();

  /** Real Seam: Injected Persistence Adapter */
  private persistenceAdapter: DocumentPersistencePort;

  /** Custom options / dependency hooks */
  private readonly options: DocumentSessionOptions;

  /** Per-file realtime (Yjs socket) connection status reported by the editor UI. */
  private readonly realtimeConnected = new Map<string, boolean>();
  /** Files whose local draft is awaiting a user restore/discard decision. */
  private readonly draftDecisionPending = new Set<string>();
  /** Unresolved remote-vs-local conflicts, keyed by fileId. */
  private readonly conflicts = new Map<string, DocumentConflict>();
  private readonly conflictListeners = new Set<ConflictListener>();

  constructor(options: DocumentSessionOptions = {}) {
    this.options = options;
    this.persistenceAdapter = options.persistenceAdapter || {
      updateContent: (fileId, content) => manuscriptService.docs.updateContent(fileId, content),
      markSaved: (fileId) => markHttpSavedWhileDisconnected(fileId),
    };

    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
  }

  // ── Dependency Injection (Seam Configuration) ───────────────────────────────

  public setPersistenceAdapter(adapter: DocumentPersistencePort): void {
    this.persistenceAdapter = adapter;
  }

  public getFsmState(fileId: string): DocumentSessionState {
    return this.getOrCreateFsmContext(fileId).state;
  }

  private getOrCreateFsmContext(fileId: string): SessionFsmContext {
    let ctx = this.fsmContexts.get(fileId);
    if (!ctx) {
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

  /**
   * While a draft recovery decision is pending, local draft snapshots for the file are
   * suppressed so stale server content can never overwrite the recoverable draft.
   */
  public beginDraftDecision(fileId: string): void {
    this.draftDecisionPending.add(fileId);
    // Drop any queued (not yet persisted) snapshot so it cannot overwrite the stored draft.
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
  }

  public endDraftDecision(fileId: string): void {
    this.draftDecisionPending.delete(fileId);
  }

  public isDraftDecisionPending(fileId: string): boolean {
    return this.draftDecisionPending.has(fileId);
  }

  /**
   * Restores a recovered draft as the live local content (marked dirty and persisted).
   */
  public restoreDraft(fileId: string, content: string): void {
    this.endDraftDecision(fileId);
    lruDocumentCache.updateContent(fileId, content, true);
    this.notifyContentChange(fileId, content, {
      isRealtimeActive: this.isRealtimeConnected(fileId),
    });
  }

  /**
   * Discards the recovered draft and keeps the server version.
   */
  public discardDraft(fileId: string): void {
    this.endDraftDecision(fileId);
    this.clearDraftSnapshot(fileId);
  }

  // ── Conflict surfacing ─────────────────────────────────────────────────────

  public onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener);
    return () => {
      this.conflictListeners.delete(listener);
    };
  }

  public getConflict(fileId: string): DocumentConflict | undefined {
    return this.conflicts.get(fileId);
  }

  public getConflicts(): DocumentConflict[] {
    return Array.from(this.conflicts.values());
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
    const conflict = this.conflicts.get(fileId);
    if (!conflict) return;
    this.conflicts.delete(fileId);

    this.transitionFsm(fileId, { type: 'CONFLICT_RESOLVED', resolution });

    if (resolution === 'take-remote') {
      // Preserve the local version as a recoverable draft before replacing it.
      this.flushDraftNow(fileId, conflict.localContent, lruDocumentCache.getModel(fileId)?.projectId);
      lruDocumentCache.updateContent(fileId, conflict.remoteContent, false);
      useCompileStore.getState().clearDirty(fileId);
      this.reindex(fileId, conflict.remoteContent);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: conflict.remoteContent });
    } else if (resolution === 'custom-merge' && typeof mergedContent === 'string') {
      // Preserve the local version as a recoverable draft before applying custom merge
      this.flushDraftNow(fileId, conflict.localContent, lruDocumentCache.getModel(fileId)?.projectId);
      lruDocumentCache.updateContent(fileId, mergedContent, true);
      useCompileStore.getState().markDirty(fileId, mergedContent);
      this.reindex(fileId, mergedContent);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: mergedContent });
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
    // Notify realtime bridges via persistence port
    this.persistenceAdapter.markSaved?.(fileId);

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
    await this.replayPendingMutations();
    await this.flushAllPending();
    if (useConnectivityStore.getState().offlinePendingCompile) {
      useConnectivityStore.getState().setOfflinePendingCompile(false);
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
    }
  }

  /**
   * Replays queued offline mutations sequentially in FIFO order upon network reconnection.
   * Ensures conflict-free sync with backend without loss of edits made while offline.
   */
  public async replayPendingMutations(): Promise<{ total: number; succeeded: number; failed: number }> {
    if (this.isReplayingMutations) {
      return { total: 0, succeeded: 0, failed: 0 };
    }
    this.isReplayingMutations = true;

    const pending = await draftStorageService.getPendingMutations();
    if (pending.length === 0) {
      this.isReplayingMutations = false;
      return { total: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const mutation of pending) {
      if (!mutation.id) continue;

      await draftStorageService.updateMutationStatus(mutation.id, 'processing');

      try {
        if (mutation.type === 'update_content') {
          const contentToSave = mutation.payload?.content ?? '';
          useConnectivityStore.getState().incrementPending();
          await this.persistenceAdapter.updateContent(mutation.fileId, contentToSave);
          await this.finalizeSuccessfulSave(mutation.fileId, contentToSave);
          useConnectivityStore.getState().decrementPending();
        }

        await draftStorageService.removeMutation(mutation.id);
        succeeded++;
      } catch (err) {
        useConnectivityStore.getState().decrementPending();
        failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        await draftStorageService.updateMutationStatus(mutation.id, 'failed', errMsg);
        console.error(`[SessionCoordinator] Failed to replay mutation ${mutation.id} for file ${mutation.fileId}:`, err);
      }
    }

    if (succeeded > 0) {
      useConnectivityStore.getState().setLastSavedAt(new Date());
      useConnectivityStore.getState().setSyncStatus('synced');
    }

    this.isReplayingMutations = false;
    return { total: pending.length, succeeded, failed };
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
    if (typeof window !== 'undefined') {
      window.addEventListener('flux:doc-content-updated', (evt: Event) => {
        const detail = (evt as CustomEvent<{ docId?: string; content?: string }>).detail;
        if (detail?.docId && typeof detail?.content === 'string') {
          this.handleRemoteContentUpdated(detail.docId, detail.content);
        }
      });
    }
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
      const v = lruDocumentCache.getContentVersion(fileId) || 0;
      this.transitionFsm(fileId, { type: 'REMOTE_EDIT', version: v });
      this.reindex(fileId, remoteContent);
      return;
    }
    if (model.content === remoteContent) {
      this.conflicts.delete(fileId);
      return;
    }
    if (this.isRealtimeConnected(fileId)) {
      return;
    }

    this.transitionFsm(fileId, { type: 'CONFLICT_DETECTED' });

    const conflict: DocumentConflict = {
      fileId,
      localContent: model.content,
      remoteContent,
      detectedAt: Date.now(),
    };
    this.conflicts.set(fileId, conflict);
    // Make sure the local version is durably backed up while the user decides.
    this.flushDraftNow(fileId, model.content, model.projectId);
    if (this.conflictListeners.size === 0) {
      console.warn(`[SessionCoordinator] Unresolved remote conflict on ${fileId}; local edits kept.`);
    }
    for (const listener of this.conflictListeners) {
      try {
        listener(conflict);
      } catch (err) {
        console.error('[SessionCoordinator] conflict listener error:', err);
      }
    }
  }

  private flushDraftNow(fileId: string, content: string, projectId?: string): void {
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
    draftStorageService.saveMemoryDraft(fileId, content, projectId);
    documentStore.saveDraft(fileId, content, this.resolveEffectiveProjectId(projectId)).catch(() => {});
  }

  private initVisibilityFlushHandler(): void {
    // Self-contained document visibility change handler
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushPendingDrafts();
          void this.flushAllPending();
        }
      });
    }

    // Also support external coordinator bridge if present
    visibilityCoordinator.registerFlushHandler(async () => {
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

    // Fast guard: only re-parse DAG graph if file contains structural include/class directives.
    const shouldCheckDag = options?.hasStructuralChange ?? true;
    if (shouldCheckDag && /\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(content)) {
      latexDagEngine.parseAndRegister(filePath, content);
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

  public async flushFile(fileId: string): Promise<boolean> {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }

    const model = lruDocumentCache.getModel(fileId);
    if (!model || !model.isDirty) {
      return true;
    }

    const isOnline =
      useConnectivityStore.getState().isOnline &&
      (typeof navigator === 'undefined' || navigator.onLine);
    if (!isOnline) {
      useConnectivityStore.getState().setSyncStatus('offline');
      this.saveDraftSnapshot(fileId, model.content, model.projectId);
      void draftStorageService.saveProjectFileSnapshot({
        id: fileId,
        projectId: this.resolveEffectiveProjectId(model.projectId),
        title: model.filePath || fileId,
        content: model.content,
        filePath: model.filePath,
        updatedAt: Date.now(),
      });
      void draftStorageService.enqueueMutation({
        fileId,
        projectId: model.projectId,
        type: 'update_content',
        payload: { content: model.content, filePath: model.filePath },
      });
      return false;
    }

    // Transition FSM to SAVING
    this.transitionFsm(fileId, { type: 'SAVE_START' });

    // Snapshot what is being sent: the live model may change while the request is in flight.
    const sentContent = model.content;
    const sentVersion = lruDocumentCache.getContentVersion(fileId);
    try {
      useConnectivityStore.getState().incrementPending();
      await this.persistenceAdapter.updateContent(fileId, sentContent);
      const clean = await this.finalizeSuccessfulSave(fileId, sentContent, sentVersion);
      useConnectivityStore.getState().decrementPending();
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return clean;
    } catch (err) {
      this.transitionFsm(fileId, { type: 'SAVE_FAILURE', error: err });
      useConnectivityStore.getState().decrementPending();
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof Error && /network|fetch|failed to fetch|offline/i.test(err.message));
      if (isNetworkError) {
        useConnectivityStore.getState().recordOffline();
        this.saveDraftSnapshot(fileId, model.content, model.projectId);
        void draftStorageService.saveProjectFileSnapshot({
          id: fileId,
          projectId: this.resolveEffectiveProjectId(model.projectId),
          title: model.filePath || fileId,
          content: model.content,
          filePath: model.filePath,
          updatedAt: Date.now(),
        });
        void draftStorageService.enqueueMutation({
          fileId,
          projectId: model.projectId,
          type: 'update_content',
          payload: { content: model.content, filePath: model.filePath },
        });
      } else {
        useConnectivityStore.getState().setSyncStatus('error');
      }
      console.error(`[SessionCoordinator] Failed to flush file ${fileId}:`, err);
      return false;
    }
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
    const isOnline =
      useConnectivityStore.getState().isOnline &&
      (typeof navigator === 'undefined' || navigator.onLine);

    if (!isOnline) {
      useConnectivityStore.getState().setSyncStatus('offline');
      for (const model of dirtyModels) {
        this.saveDraftSnapshot(model.fileId, model.content, model.projectId);
        void draftStorageService.saveProjectFileSnapshot({
          id: model.fileId,
          projectId: this.resolveEffectiveProjectId(model.projectId),
          title: model.filePath || model.fileId,
          content: model.content,
          filePath: model.filePath,
          updatedAt: Date.now(),
        });
        void draftStorageService.enqueueMutation({
          fileId: model.fileId,
          projectId: model.projectId,
          type: 'update_content',
          payload: { content: model.content, filePath: model.filePath },
        });
      }
      this.isFlushingAll = false;
      return { total: dirtyModels.length, succeeded: 0, failed: 0, results: [] };
    }

    const results: FlushResult[] = [];
    let succeeded = 0;
    let failed = 0;

    const flushPromises = dirtyModels.map(async (model) => {
      const sentContent = model.content;
      const sentVersion = lruDocumentCache.getContentVersion(model.fileId);
      this.transitionFsm(model.fileId, { type: 'SAVE_START' });
      try {
        useConnectivityStore.getState().incrementPending();
        await this.persistenceAdapter.updateContent(model.fileId, sentContent);
        await this.finalizeSuccessfulSave(model.fileId, sentContent, sentVersion);
        useConnectivityStore.getState().decrementPending();
        useConnectivityStore.getState().setLastSavedAt(new Date());
        succeeded++;
        results.push({ fileId: model.fileId, success: true });
      } catch (err) {
        this.transitionFsm(model.fileId, { type: 'SAVE_FAILURE', error: err });
        useConnectivityStore.getState().decrementPending();
        const isNetworkError =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          (err instanceof Error && /network|fetch|failed to fetch|offline/i.test(err.message));
        if (isNetworkError) {
          useConnectivityStore.getState().recordOffline();
          this.saveDraftSnapshot(model.fileId, model.content, model.projectId);
          void draftStorageService.saveProjectFileSnapshot({
            id: model.fileId,
            projectId: this.resolveEffectiveProjectId(model.projectId),
            title: model.filePath || model.fileId,
            content: model.content,
            filePath: model.filePath,
            updatedAt: Date.now(),
          });
          void draftStorageService.enqueueMutation({
            fileId: model.fileId,
            projectId: model.projectId,
            type: 'update_content',
            payload: { content: model.content, filePath: model.filePath },
          });
        } else {
          useConnectivityStore.getState().setSyncStatus('error');
        }
        failed++;
        results.push({ fileId: model.fileId, success: false, error: err });
        console.error(`[SessionCoordinator] Error flushing file ${model.fileId}:`, err);
      }
    });

    await Promise.allSettled(flushPromises);
    this.isFlushingAll = false;

    return { total: dirtyModels.length, succeeded, failed, results };
  }

  public flushPendingDrafts(): void {
    for (const [fileId, pending] of this.pendingDrafts.entries()) {
      const timer = this.draftTimers.get(fileId);
      if (timer) {
        clearTimeout(timer);
        this.draftTimers.delete(fileId);
      }
      documentStore.saveDraft(
        fileId,
        pending.content,
        this.resolveEffectiveProjectId(pending.projectId)
      ).catch(() => {});
    }
    this.pendingDrafts.clear();
  }

  public saveDraftSnapshot(fileId: string, content: string, projectId?: string): void {
    if (this.draftDecisionPending.has(fileId)) return;

    draftStorageService.saveMemoryDraft(fileId, content, projectId);

    const existingTimer = this.draftTimers.get(fileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.draftTimers.delete(fileId);
    }

    this.pendingDrafts.set(fileId, { content, projectId });
    const timer = setTimeout(() => {
      this.draftTimers.delete(fileId);
      const pending = this.pendingDrafts.get(fileId);
      if (pending) {
        this.pendingDrafts.delete(fileId);
        documentStore.saveDraft(
          fileId,
          pending.content,
          this.resolveEffectiveProjectId(pending.projectId)
        ).catch(() => {});
      }
    }, 600);
    this.draftTimers.set(fileId, timer);
  }

  public clearDraftSnapshot(fileId: string): void {
    if (this.draftDecisionPending.has(fileId)) return;
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
    documentStore.clearDraft(fileId).catch(() => {});
  }

  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    return documentStore.checkDraftRecovery(fileId, serverContent);
  }

  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    return documentStore.checkDraftRecoveryAsync(fileId, serverContent);
  }

  public switchTab(fromFileId: string | null, toFileId: string): void {
    if (fromFileId && fromFileId !== toFileId) {
      // Synchronize uncommitted active editor keystrokes into outgoing LRU model before deactivating
      const activeEngine = getActiveEditorEngine();
      const activeContent =
        activeEngine && typeof activeEngine.getContent === 'function'
          ? getActiveEditorContent()
          : undefined;
      const fromModel = lruDocumentCache.getModel(fromFileId);
      if (activeContent !== undefined && fromModel && fromModel.content !== activeContent) {
        lruDocumentCache.updateContent(fromFileId, activeContent, true);
        useCompileStore.getState().markDirty(fromFileId, activeContent);
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

  public closeTab(fileId: string): void {
    this.transitionFsm(fileId, { type: 'EVICT' });
    void this.flushFile(fileId);
    lruDocumentCache.evictModel(fileId);
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
// Backward compatibility alias
export const documentSessionCoordinator = sessionCoordinator;
