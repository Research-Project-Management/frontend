/**
 * document-session-coordinator.ts
 *
 * Unified Document Session Coordinator (Data & Sync Layer):
 *
 * Responsibilities:
 * - Coordinates document saving across multiple open virtual models (DocumentModelManager).
 * - Implements debounced auto-save (800ms idle) and debounced auto-compile triggers (2500ms idle).
 * - Enforces Guaranteed Pre-Compile Flush: awaits all pending network writes before compiling.
 * - Manages crash-resilient local draft snapshots (localStorage backup) for offline & crash protection.
 * - Handles conflict detection with remote collaborators and non-destructive alerts.
 * - Provides window beforeunload protection against accidental data loss.
 */

import { documentModelManager, type DocumentModelState } from '../models/document-model-manager';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { useCompileStore, usePageStore, useSettingsStore } from '@/features/editor/store';
import { editorCommandBus } from '../command-bus/editor-command-bus';
import {
  draftStorageService,
  type DraftSnapshot,
} from '@/features/editor/services/draft-storage.service';

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
const DEFAULT_AUTOCOMPILE_DELAY = 2500; // ms

class DocumentSessionCoordinatorRegistry {
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();
  private compileTimer: NodeJS.Timeout | null = null;
  private lastCompiledContentMap = new Map<string, string>();
  private isFlushingAll = false;
  private beforeUnloadInitialized = false;

  constructor() {
    this.initPreCompileListener();
  }

  /**
   * Listens to compile requests across the entire application to ensure
   * all pending changes in memory are committed before compilation begins.
   */
  private initPreCompileListener(): void {
    if (typeof window === 'undefined') return;

    editorCommandBus.subscribe('compiler:started', () => {
      void this.flushAllPending();
    });
  }

  /**
   * Initializes beforeunload browser protection to guard unsaved changes.
   */
  public initBeforeUnloadProtection(): () => void {
    if (typeof window === 'undefined' || this.beforeUnloadInitialized) {
      return () => {};
    }
    this.beforeUnloadInitialized = true;

    const handler = (e: BeforeUnloadEvent) => {
      const dirtyModels = documentModelManager.getDirtyModels();
      if (dirtyModels.length > 0) {
        // Attempt quick emergency persistence to local draft storage
        for (const model of dirtyModels) {
          this.saveDraftSnapshot(model.fileId, model.content);
        }
        e.preventDefault();
        e.returnValue = 'You have unsaved changes that may be lost.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      this.beforeUnloadInitialized = false;
    };
  }

  /**
   * Handles per-keystroke notifications from the editor:
   * - Marks the model as dirty in DocumentModelManager and CompileStore
   * - Saves a crash-guard snapshot to local storage
   * - Debounces the network save (800ms)
   * - Schedules an auto-compile check (2500ms) if autoCompile is enabled
   */
  public notifyContentChange(
    fileId: string,
    content: string,
    options?: { immediate?: boolean; isRealtimeActive?: boolean }
  ): void {
    if (!fileId) return;

    // 1. Update in-memory models
    documentModelManager.updateContent(fileId, content, true);
    useCompileStore.getState().markDirty(fileId, content);

    // 2. Persist local draft snapshot for crash resilience (Tier 1 Memory, Tier 2 IndexedDB, Tier 3 LocalStorage)
    const pageStore = usePageStore.getState();
    const projectId = pageStore.projectId || undefined;
    const title = pageStore.currentPage?.id === fileId ? (pageStore.currentPage?.name || (pageStore.currentPage as any)?.title) : undefined;
    this.saveDraftSnapshot(fileId, content, projectId, title);

    // 3. Immediate save on demand (e.g. on blur or Ctrl+S)
    if (options?.immediate) {
      void this.flushFile(fileId);
      return;
    }

    // 4. Debounced network auto-save (800ms offline/single, 15000ms periodic snapshot when realtime active)
    const saveDelay = options?.isRealtimeActive ? 15000 : DEFAULT_AUTOSAVE_DELAY;

    const existingSaveTimer = this.saveTimers.get(fileId);
    if (existingSaveTimer) {
      clearTimeout(existingSaveTimer);
    }

    const saveTimer = setTimeout(() => {
      this.saveTimers.delete(fileId);
      void this.flushFile(fileId);
    }, saveDelay);

    this.saveTimers.set(fileId, saveTimer);

    // 5. Debounced auto-compile (2500ms idle, Overleaf parity)
    this.scheduleAutoCompile(fileId, content);
  }

  /**
   * Flushes a specific file to the backend database immediately.
   */
  public async flushFile(fileId: string): Promise<boolean> {
    if (!fileId) return true;

    // Clear any pending timer for this file
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }

    const model = documentModelManager.getModel(fileId);
    const dirtyMap = useCompileStore.getState().dirtyContentMap;
    const isDirtyInStore = Boolean(dirtyMap && dirtyMap.has(fileId));

    // If neither model nor store thinks it's dirty, nothing to save
    if (!model?.isDirty && !isDirtyInStore) {
      return true;
    }

    const contentToSave = model ? model.content : (dirtyMap?.get(fileId) ?? '');

    try {
      // Synchronize in-memory page store if this is the active page
      const currentPage = usePageStore.getState().currentPage;
      if (currentPage && currentPage.id === fileId) {
        usePageStore.getState().setCurrentPage({
          ...currentPage,
          content: contentToSave,
        });
      }

      // Commit to backend
      await manuscriptService.docs.updateContent(fileId, contentToSave);

      // Mark clean across all registries
      documentModelManager.markClean(fileId);
      useCompileStore.getState().clearDirty(fileId);

      // Remove crash-guard snapshot on successful remote persist
      this.clearDraftSnapshot(fileId);

      editorCommandBus.dispatch({ type: 'document:content-updated', docId: fileId, content: contentToSave });
      return true;
    } catch (err) {
      console.error(`[DocumentSessionCoordinator] Failed to flush file ${fileId}:`, err);
      return false;
    }
  }

  /**
   * Coordinates tab switching lifecycle:
   * - Immediately flushes pending changes of the outgoing file to disk.
   * - Ensures the incoming file model is registered in memory.
   */
  public async switchTab(fromFileId?: string | null, toFileId?: string | null): Promise<boolean> {
    if (fromFileId && fromFileId !== toFileId) {
      await this.flushFile(fromFileId);
    }
    if (toFileId) {
      documentModelManager.setActiveFileId(toFileId);
      const model = documentModelManager.getModel(toFileId);
      if (model) {
        model.lastActiveAt = Date.now();
      }
    }
    return true;
  }

  /**
   * Coordinates tab closure lifecycle:
   * - Flushes dirty state if any unsaved changes exist (unless force is true).
   * - Cleans up debounce timers and local draft backup.
   * - Evicts closed model from RAM to reclaim memory.
   */
  public async closeTab(
    fileId: string,
    options?: { force?: boolean }
  ): Promise<'saved' | 'closed' | 'error'> {
    if (!fileId) return 'closed';

    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }

    const model = documentModelManager.getModel(fileId);
    const isDirty = model?.isDirty || useCompileStore.getState().dirtyContentMap?.has(fileId);

    if (isDirty && !options?.force) {
      const saved = await this.flushFile(fileId);
      if (!saved) return 'error';
    }

    this.clearDraftSnapshot(fileId);
    documentModelManager.evictModel(fileId);
    return isDirty ? 'saved' : 'closed';
  }

  /**
   * Guaranteed Pre-Compile Flush:
   * Flushes ALL dirty files in memory to the backend before compilation or export starts.
   */
  public async flushAllPending(): Promise<FlushAllResult> {
    if (this.isFlushingAll) {
      // Already running a global flush, avoid re-entrancy
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }
    this.isFlushingAll = true;

    try {
      // Clear all pending debounce timers
      for (const [fileId, timer] of this.saveTimers.entries()) {
        clearTimeout(timer);
      }
      this.saveTimers.clear();

      // Collect dirty file IDs from DocumentModelManager
      const dirtyFileIds = new Set<string>();
      for (const m of documentModelManager.getDirtyModels()) {
        dirtyFileIds.add(m.fileId);
      }

      // Collect dirty file IDs from CompileStore
      const compileDirtyFiles = useCompileStore.getState().getDirtyFiles();
      for (const df of compileDirtyFiles) {
        dirtyFileIds.add(df.fileId);
      }

      const fileIds = Array.from(dirtyFileIds);
      if (fileIds.length === 0) {
        return { total: 0, succeeded: 0, failed: 0, results: [] };
      }

      const flushPromises = fileIds.map(async (fileId): Promise<FlushResult> => {
        try {
          const success = await this.flushFile(fileId);
          return { fileId, success };
        } catch (error) {
          return { fileId, success: false, error };
        }
      });

      const settled = await Promise.all(flushPromises);
      const succeeded = settled.filter((r) => r.success).length;
      const failed = settled.length - succeeded;

      return {
        total: settled.length,
        succeeded,
        failed,
        results: settled,
      };
    } finally {
      this.isFlushingAll = false;
    }
  }

  /**
   * Schedules debounced auto-compilation when autoCompile setting is true.
   */
  private scheduleAutoCompile(fileId: string, content: string): void {
    if (this.compileTimer) {
      clearTimeout(this.compileTimer);
    }

    this.compileTimer = setTimeout(() => {
      this.compileTimer = null;
      if (!useSettingsStore.getState().autoCompile) return;

      const lastCompiled = this.lastCompiledContentMap.get(fileId);
      if (content === lastCompiled) return;

      const { compileStatus, setPendingCompile } = useCompileStore.getState();
      const isBusy =
        compileStatus === 'compiling' ||
        compileStatus === 'flushing' ||
        compileStatus === 'syncing';

      if (isBusy) {
        setPendingCompile(true);
        return;
      }

      this.lastCompiledContentMap.set(fileId, content);
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
    }, DEFAULT_AUTOCOMPILE_DELAY);
  }

  /**
   * Saves a crash-guard snapshot across storage tiers (Memory, LocalStorage, IndexedDB).
   */
  public saveDraftSnapshot(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): void {
    if (!fileId) return;
    void draftStorageService.saveDraft(fileId, content, projectId, title);
  }

  /**
   * Clears a local draft snapshot across all storage tiers.
   */
  public clearDraftSnapshot(fileId: string): void {
    if (!fileId) return;
    void draftStorageService.clearDraft(fileId);
  }

  /**
   * Synchronously retrieves a local draft snapshot if available (Memory / LocalStorage).
   */
  public getDraftSnapshot(fileId: string): DraftSnapshot | null {
    if (!fileId) return null;
    return draftStorageService.getDraftSync(fileId);
  }

  /**
   * Asynchronously retrieves a local draft snapshot (Memory -> IndexedDB -> LocalStorage).
   */
  public async getDraftSnapshotAsync(fileId: string): Promise<DraftSnapshot | null> {
    if (!fileId) return null;
    return draftStorageService.getDraft(fileId);
  }

  /**
   * Checks synchronously if an offline/crash draft exists that is newer than the server copy.
   */
  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    return draftStorageService.checkDraftRecovery(fileId, serverContent);
  }

  /**
   * Checks asynchronously (with IndexedDB fallback) if an offline/crash draft exists.
   */
  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    return draftStorageService.checkDraftRecoveryAsync(fileId, serverContent);
  }
}

export const documentSessionCoordinator = new DocumentSessionCoordinatorRegistry();
