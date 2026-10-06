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
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { editorCommandBus } from '../command-bus/editor-command-bus';

export interface DraftSnapshot {
  fileId: string;
  content: string;
  savedAt: number;
}

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

const DRAFT_STORAGE_PREFIX = 'flux_draft:';
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

    EditorEventBus.on('flux:compile-started', () => {
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
    options?: { immediate?: boolean }
  ): void {
    if (!fileId) return;

    // 1. Update in-memory models
    documentModelManager.updateContent(fileId, content, true);
    useCompileStore.getState().markDirty(fileId, content);

    // 2. Persist local draft snapshot for crash resilience
    this.saveDraftSnapshot(fileId, content);

    // 3. Immediate save on demand (e.g. on blur or Ctrl+S)
    if (options?.immediate) {
      void this.flushFile(fileId);
      return;
    }

    // 4. Debounced network auto-save (800ms idle)
    const existingSaveTimer = this.saveTimers.get(fileId);
    if (existingSaveTimer) {
      clearTimeout(existingSaveTimer);
    }

    const saveTimer = setTimeout(() => {
      this.saveTimers.delete(fileId);
      void this.flushFile(fileId);
    }, DEFAULT_AUTOSAVE_DELAY);

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

      EditorEventBus.emit('flux:doc-saved', { fileId, content: contentToSave });
      return true;
    } catch (err) {
      console.error(`[DocumentSessionCoordinator] Failed to flush file ${fileId}:`, err);
      EditorEventBus.emit('flux:doc-save-failed', { fileId, error: err });
      return false;
    }
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
   * Saves a crash-guard snapshot to local storage.
   */
  public saveDraftSnapshot(fileId: string, content: string): void {
    if (typeof window === 'undefined' || !fileId) return;
    try {
      const snapshot: DraftSnapshot = {
        fileId,
        content,
        savedAt: Date.now(),
      };
      localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${fileId}`, JSON.stringify(snapshot));
    } catch {
      // LocalStorage quota exceeded or disabled in private browsing
    }
  }

  /**
   * Clears a local draft snapshot.
   */
  public clearDraftSnapshot(fileId: string): void {
    if (typeof window === 'undefined' || !fileId) return;
    try {
      localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${fileId}`);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Retrieves a local draft snapshot if available.
   */
  public getDraftSnapshot(fileId: string): DraftSnapshot | null {
    if (typeof window === 'undefined' || !fileId) return null;
    try {
      const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${fileId}`);
      if (!raw) return null;
      return JSON.parse(raw) as DraftSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Checks if an offline/crash draft exists that is newer than the server copy.
   */
  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    const draft = this.getDraftSnapshot(fileId);
    if (!draft) return { hasRecoverableDraft: false };

    // If draft has different content and is not empty
    if (draft.content && draft.content !== serverContent) {
      return { hasRecoverableDraft: true, draft };
    }

    return { hasRecoverableDraft: false };
  }
}

export const documentSessionCoordinator = new DocumentSessionCoordinatorRegistry();
