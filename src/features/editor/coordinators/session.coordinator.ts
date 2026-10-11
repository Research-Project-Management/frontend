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

import {
  documentStore,
  lruDocumentCache,
  draftStorageService,
  type DocumentModelState,
  type DraftSnapshot,
  type ProjectFileSnapshot,
  type OfflineMutation,
} from '../domain/document';
import { latexSymbolsIndex } from '../domain/latex/latex-symbols-index';
import { latexDagEngine } from '../domain/latex/latex-dag-engine';
import { manuscriptService } from '@/features/editor/sdk';
import { useCompileStore, usePageStore, useSettingsStore, useConnectivityStore } from '../store';
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

  constructor() {
    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
  }

  private resolveEffectiveProjectId(modelProjectId?: string): string {
    return modelProjectId || usePageStore.getState().projectId || 'workspace-local';
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
          lruDocumentCache.markClean(mutation.fileId);
          useCompileStore.getState().clearDirty(mutation.fileId);
          await draftStorageService.clearDraft(mutation.fileId);
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
      // Remote collaborator updated a document over WebSocket
      const model = lruDocumentCache.getModel(cmd.docId);
      if (!model?.isDirty) {
        lruDocumentCache.updateContent(cmd.docId, cmd.content, false);
        const filePath = model?.filePath || cmd.docId;
        latexSymbolsIndex.indexFile(cmd.docId, filePath, cmd.content);
        if (/\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(cmd.content)) {
          latexDagEngine.parseAndRegister(filePath, cmd.content, cmd.docId);
        }
      }
    });
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
    const isRealtime = options?.isRealtimeActive ?? false;
    const isRemote = options?.origin === 'remote';

    // 1. In-memory hot RAM update (0ms latency). If remote, keep local dirty flag clean
    lruDocumentCache.updateContent(fileId, content, !isRemote);

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
      // Do not mark local dirty or schedule redundant local draft / autosave.
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

    try {
      useConnectivityStore.getState().incrementPending();
      await manuscriptService.docs.updateContent(fileId, model.content);
      lruDocumentCache.markClean(fileId);
      useCompileStore.getState().clearDirty(fileId);
      this.clearDraftSnapshot(fileId);
      useConnectivityStore.getState().decrementPending();
      useConnectivityStore.getState().setLastSavedAt(new Date());
      return true;
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
      try {
        useConnectivityStore.getState().incrementPending();
        await manuscriptService.docs.updateContent(model.fileId, model.content);
        lruDocumentCache.markClean(model.fileId);
        useCompileStore.getState().clearDirty(model.fileId);
        this.clearDraftSnapshot(model.fileId);
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
