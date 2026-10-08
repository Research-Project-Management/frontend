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

import { lruDocumentCache, type DocumentModelState } from '../domain/document/lru-document-cache';
import { latexSymbolsIndex } from '../domain/latex/latex-symbols-index';
import { latexDagEngine } from '../domain/latex/latex-dag-engine';
import { manuscriptService } from './services/manuscript.service';
import { useCompileStore, usePageStore, useSettingsStore, useConnectivityStore } from '../store';
import { editorCommandBus } from './command-bus';
import { visibilityCoordinator } from './visibility.coordinator';
import {
  draftStorageService,
  type DraftSnapshot,
} from './services/draft-storage.service';

export type { DraftSnapshot };

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
  private compileTimer: NodeJS.Timeout | null = null;
  private lastCompiledContentMap = new Map<string, string>();
  private isFlushingAll = false;
  private beforeUnloadInitialized = false;

  constructor() {
    this.initVisibilityFlushHandler();
    this.initCommandSubscriptions();
    this.initOnlineListener();
  }

  private initOnlineListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      useConnectivityStore.getState().setIsOnline(true);
      void this.flushAllPending();
    });
    window.addEventListener('offline', () => {
      useConnectivityStore.getState().setIsOnline(false);
    });
  }

  private initCommandSubscriptions(): void {
    editorCommandBus.subscribe('document:content-updated', (cmd) => {
      // Remote collaborator updated a document over WebSocket
      const model = lruDocumentCache.getModel(cmd.docId);
      if (!model?.isDirty) {
        lruDocumentCache.updateContent(cmd.docId, cmd.content, false);
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
    }
  ): void {
    const isRealtime = options?.isRealtimeActive ?? false;

    // 1. In-memory hot RAM update (0ms latency)
    lruDocumentCache.updateContent(fileId, content, true);

    // 1b. Incrementally update Cross-file LaTeX symbols (Offloaded to Web Worker)
    const currentModel = lruDocumentCache.getModel(fileId);
    const filePath = currentModel?.filePath || fileId;
    latexSymbolsIndex.indexFile(fileId, filePath, content);

    // Fast guard: only re-parse DAG graph if file contains structural include/class directives
    if (/\\(?:documentclass|input|include|subfile|import|bibliography|addbibresource)/.test(content)) {
      latexDagEngine.parseAndRegister(filePath, content);
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
      useConnectivityStore.getState().setSyncStatus('error');
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

    const dirtyModels = lruDocumentCache.getDirtyModels();
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
        useConnectivityStore.getState().setSyncStatus('error');
        failed++;
        results.push({ fileId: model.fileId, success: false, error: err });
        console.error(`[SessionCoordinator] Error flushing file ${model.fileId}:`, err);
      }
    });

    await Promise.allSettled(flushPromises);
    this.isFlushingAll = false;

    return { total: dirtyModels.length, succeeded, failed, results };
  }

  public saveDraftSnapshot(fileId: string, content: string, projectId?: string): void {
    draftStorageService.saveDraft(
      fileId,
      content,
      projectId || 'anonymous'
    ).catch(() => {});
  }

  public clearDraftSnapshot(fileId: string): void {
    draftStorageService.clearDraft(fileId).catch(() => {});
  }

  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    const memoryModel = lruDocumentCache.getModel(fileId);
    if (memoryModel && memoryModel.isDirty && memoryModel.content !== serverContent) {
      return {
        hasRecoverableDraft: true,
        draft: {
          fileId,
          content: memoryModel.content,
          savedAt: memoryModel.lastActiveAt,
          projectId: memoryModel.projectId || '',
          title: memoryModel.filePath,
        },
      };
    }
    return { hasRecoverableDraft: false };
  }

  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    const memoryCheck = this.checkDraftRecovery(fileId, serverContent);
    if (memoryCheck.hasRecoverableDraft) return memoryCheck;

    try {
      const persistedDraft = await draftStorageService.getDraft(fileId);
      if (
        persistedDraft &&
        persistedDraft.content &&
        persistedDraft.content !== serverContent
      ) {
        return { hasRecoverableDraft: true, draft: persistedDraft };
      }
    } catch {}

    return { hasRecoverableDraft: false };
  }

  public switchTab(fromFileId: string | null, toFileId: string): void {
    if (fromFileId && fromFileId !== toFileId) {
      const fromModel = lruDocumentCache.getModel(fromFileId);
      if (fromModel && fromModel.isDirty) {
        this.saveDraftSnapshot(fromFileId, fromModel.content, fromModel.projectId);
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
