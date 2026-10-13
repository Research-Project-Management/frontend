/**
 * session.coordinator.ts
 *
 * Unified Document Session Coordinator (Coordinators Layer):
 *
 * Responsibilities:
 * - Coordinates document saving across multiple open virtual models (LRUDocumentCache).
 * - Implements debounced auto-save (800ms idle) and debounced auto-compile triggers (2500ms idle).
 * - Enforces Guaranteed Pre-Compile Flush: awaits all pending network writes before compiling.
 * - Manages crash-resilient local draft snapshots (IndexedDB / localStorage) for offline & crash protection.
 * - Handles conflict detection with remote collaborators and non-destructive alerts.
 * - Provides window beforeunload protection against accidental data loss.
 */

import { documentStore } from '../domain/document/document-store';
import {
  lruDocumentCache,
  type DocumentModelState,
} from '../domain/document/lru-document-cache';
import {
  draftStorageService,
  type DraftSnapshot,
  type ProjectFileSnapshot,
  type OfflineMutation,
} from '../domain/document/draft-storage';
import { latexSymbolsIndex } from '../domain/latex/latex-symbols-index';
import { latexDagEngine } from '../domain/latex/latex-dag-engine';
import { manuscriptService } from '../sdk/manuscript.service';
import { markHttpSavedWhileDisconnected } from '../sdk/realtime/yjs-socket-provider';
import { useCompileStore } from '../store/compiler.store';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { useConnectivityStore } from '../store/connectivity.store';
import { editorCommandBus } from './command-bus';
import { visibilityCoordinator } from './visibility.coordinator';

export type { DraftSnapshot, ProjectFileSnapshot, OfflineMutation };

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
  /** Per-file realtime (Yjs socket) connection status reported by the editor UI. */
  private readonly realtimeConnected = new Map<string, boolean>();
  /** Files whose local draft is awaiting a user restore/discard decision. */
  private readonly draftDecisionPending = new Set<string>();
  /** Unresolved remote-vs-local conflicts, keyed by fileId. */
  private readonly conflicts = new Map<string, DocumentConflict>();
  private readonly conflictListeners = new Set<ConflictListener>();

  constructor() {
    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
  }

  private resolveEffectiveProjectId(modelProjectId?: string): string {
    return modelProjectId || usePageStore.getState().projectId || 'workspace-local';
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
        this.scheduleAutoSave(fileId, DEFAULT_AUTOSAVE_DELAY);
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

  /**
   * Resolves a surfaced conflict.
   * - 'keep-local': local edits stay dirty and will be saved, overwriting the remote version.
   * - 'take-remote': local content is replaced by the remote version (local copy kept as draft).
   */
  public resolveConflict(fileId: string, resolution: 'keep-local' | 'take-remote'): void {
    const conflict = this.conflicts.get(fileId);
    if (!conflict) return;
    this.conflicts.delete(fileId);
    if (resolution === 'take-remote') {
      // Preserve the local version as a recoverable draft before replacing it.
      this.flushDraftNow(fileId, conflict.localContent, lruDocumentCache.getModel(fileId)?.projectId);
      lruDocumentCache.updateContent(fileId, conflict.remoteContent, false);
      useCompileStore.getState().clearDirty(fileId);
      this.reindex(fileId, conflict.remoteContent);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: conflict.remoteContent });
    } else {
      this.scheduleAutoSave(fileId, DEFAULT_AUTOSAVE_DELAY);
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
    // The backend splices REST content into the live server Y.Doc. If our realtime socket is down,
    // the provider must rebuild from the server on reconnect instead of replaying offline items.
    markHttpSavedWhileDisconnected(fileId);
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
      this.scheduleAutoSave(fileId, DEFAULT_AUTOSAVE_DELAY);
    }
    return false;
  }

  public async handleOnline(): Promise<void> {
    useConnectivityStore.getState().recordOnline();
    await this.replayPendingMutations();
    await this.flushAllPending();
    if (useConnectivityStore.getState().offlinePendingCompile) {
      useConnectivityStore.getState().setOfflinePendingCompile(false);
      editorCommandBus.dispatch({ type: 'compiler:trigger', draft: true });
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
          await manuscriptService.docs.updateContent(mutation.fileId, contentToSave);
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
    } else {
      lruDocumentCache.updateContent(fileId, content, true);
    }

    // 1b. Incrementally update Cross-file LaTeX symbols (Offloaded to Web Worker)
    const currentModel = lruDocumentCache.getModel(fileId);
    const filePath = currentModel?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);

    // Fast guard: only re-parse DAG graph if file contains structural include/class directives.
    // If hasStructuralChange is explicitly false, skip O(N) regex and DAG re-scan completely.
    const shouldCheckDag = options?.hasStructuralChange ?? true;
    if (shouldCheckDag && /\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(content)) {
      latexDagEngine.parseAndRegister(filePath, content);
    }

    if (isRemote) {
      // Remote changes are already persisted and broadcasted by remote peer;
      // Do not mark local dirty or schedule redundant autosave. If unsaved local edits
      // exist, refresh the draft backup so it reflects the merged document.
      if (currentModel?.isDirty) {
        this.saveDraftSnapshot(fileId, content, currentModel.projectId);
      }
      return;
    }

    // 2. Mark dirty in compile store for immediate incremental compilation inclusion
    useCompileStore.getState().markDirty(fileId, content);

    // 3. Local crash resilience backup (Tier 2 persistence)
    const activeProjectId = usePageStore.getState().projectId || undefined;
    this.saveDraftSnapshot(fileId, content, activeProjectId);

    // 4. Schedule debounced auto-save to backend
    if (!isRealtime) {
      this.scheduleAutoSave(fileId, options?.customAutoSaveDelay ?? DEFAULT_AUTOSAVE_DELAY);
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

    // Snapshot what is being sent: the live model may change while the request is in flight.
    const sentContent = model.content;
    const sentVersion = lruDocumentCache.getContentVersion(fileId);
    try {
      useConnectivityStore.getState().incrementPending();
      await manuscriptService.docs.updateContent(fileId, sentContent);
      const clean = await this.finalizeSuccessfulSave(fileId, sentContent, sentVersion);
      useConnectivityStore.getState().decrementPending();
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return clean;
    } catch (err) {
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
      try {
        useConnectivityStore.getState().incrementPending();
        await manuscriptService.docs.updateContent(model.fileId, sentContent);
        await this.finalizeSuccessfulSave(model.fileId, sentContent, sentVersion);
        useConnectivityStore.getState().decrementPending();
        useConnectivityStore.getState().setLastSavedAt(new Date());
        succeeded++;
        results.push({ fileId: model.fileId, success: true });
      } catch (err) {
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
    // Never overwrite a recoverable draft (with e.g. stale server content) before the user
    // has chosen to restore or discard it.
    if (this.draftDecisionPending.has(fileId)) return;

    // 1. Immediately update in-memory cache for synchronous 0ms lookup
    draftStorageService.saveMemoryDraft(fileId, content, projectId);

    const existingTimer = this.draftTimers.get(fileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.draftTimers.delete(fileId);
    }

    // 2. Debounce disk persistence (LocalStorage / IndexedDB) by 600ms to eliminate typing stutter
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
    // The recoverable draft must survive until the user decides (discardDraft ends the gate first).
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
      const fromModel = lruDocumentCache.getModel(fromFileId);
      if (fromModel && fromModel.isDirty) {
        this.saveDraftSnapshot(fromFileId, fromModel.content, fromModel.projectId);
        this.flushPendingDrafts();
      }
    }
    lruDocumentCache.setActiveFileId(toFileId);
  }

  public closeTab(fileId: string): void {
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
    const isAutoCompile = useSettingsStore.getState().autoCompile;
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
      editorCommandBus.dispatch({ type: 'compiler:trigger', draft: true });
    }, DEFAULT_AUTOCOMPILE_DELAY);
  }
}

export const sessionCoordinator = new SessionCoordinatorRegistry();
// Backward compatibility alias
export const documentSessionCoordinator = sessionCoordinator;
