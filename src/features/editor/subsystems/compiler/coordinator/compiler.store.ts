/**
 * compiler.store.ts
 *
 * Store for LaTeX compilation lifecycle, incremental dirty-file tracking, and diagnostic logs.
 */

import { create } from 'zustand';
import type { CompileStatus, CompileError } from '@/features/editor/domain/types/compiler.types';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

export interface DocumentCompilerState {
  // ── Dirty content tracking ─────────────────────────────────────────────
  /** fileId → latest editor content (updated on every keystroke, debounced ~300ms) */
  dirtyContentMap: Map<string, string>;
  /** Set of dirty file IDs for O(1) reactive checking without content churn */
  dirtyFileIds: Set<string>;
  isDirtyFile: (fileId: string) => boolean;
  markDirty: (fileId: string, content: string) => void;
  clearDirty: (fileId: string) => void;
  clearAllDirty: () => void;
  getDirtyFiles: () => Array<{ fileId: string; content: string }>;

  // ── Incremental sync tracking ──────────────────────────────────────────
  /** fileId → unix ms timestamp of last successful sync to the compiler */
  lastSyncedAt: Map<string, number>;
  markSynced: (fileId: string) => void;
  clearSyncTracker: () => void;

  // ── Compile state (background, non-blocking) ───────────────────────────
  compileStatus: CompileStatus;
  compileLog: string | null;
  /** Parsed error list from the last failed compilation */
  compileErrors: CompileError[];
  pdfUrl: string | null;
  lastCompiledAt: Date | null;
  pendingCompile: boolean;
  isViewerPoppedOut: boolean;

  setCompileStatus: (status: CompileStatus) => void;
  setCompileLog: (log: string | null) => void;
  setCompileErrors: (errors: CompileError[]) => void;
  /** Sets the PDF blob URL, revoking the previous blob URL to prevent leaks */
  setPdfUrl: (url: string | null) => void;
  setLastCompiledAt: (date: Date | null) => void;
  clearLogs: () => void;
  resetCompiler: () => void;
  setPendingCompile: (pending: boolean) => void;
  setIsViewerPoppedOut: (poppedOut: boolean) => void;
}

export const useCompileStore = create<DocumentCompilerState>()((set, get) => ({
  // ── Dirty tracking (Derived directly from lruDocumentCache) ───────────
  dirtyContentMap: new Map(),
  dirtyFileIds: new Set(),

  isDirtyFile(fileId: string) {
    return lruDocumentCache.isDirty(fileId);
  },

  markDirty(fileId, content) {
    lruDocumentCache.updateContent(fileId, content, true);
  },

  clearDirty(fileId) {
    lruDocumentCache.markClean(fileId);
  },

  clearAllDirty() {
    lruDocumentCache.clearAllDirty();
  },

  getDirtyFiles() {
    return lruDocumentCache.getDirtyModels().map((m) => ({
      fileId: m.fileId,
      content: m.content,
    }));
  },

  // ── Sync tracking ─────────────────────────────────────────────────────
  lastSyncedAt: new Map(),

  markSynced(fileId) {
    set((s) => {
      const next = new Map(s.lastSyncedAt);
      next.set(fileId, Date.now());
      return { lastSyncedAt: next };
    });
  },

  clearSyncTracker() {
    set({ lastSyncedAt: new Map() });
  },

  // ── Compile state ─────────────────────────────────────────────────────
  compileStatus: 'idle',
  compileLog: null,
  compileErrors: [],
  pdfUrl: null,
  lastCompiledAt: null,
  pendingCompile: false,
  isViewerPoppedOut: false,

  setCompileStatus(status) {
    set({ compileStatus: status });
  },

  setCompileLog(log) {
    if (!log) {
      set({ compileLog: null });
      return;
    }
    const MAX_LOG_LENGTH = 500_000;
    const trimmed = log.length > MAX_LOG_LENGTH ? '... [truncated previous logs]\n' + log.slice(log.length - MAX_LOG_LENGTH) : log;
    set({ compileLog: trimmed });
  },

  setCompileErrors(errors) {
    set({ compileErrors: errors });
  },

  setPdfUrl(url) {
    // Revoke the old blob URL before setting the new one to prevent memory leaks,
    // but only when the URL actually changes to avoid invalidating the active PDF.
    const prev = get().pdfUrl;
    if (prev && prev.startsWith('blob:') && prev !== url) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // Ignore revocation errors
      }
    }
    set({ pdfUrl: url });
  },

  setLastCompiledAt(date) {
    set({ lastCompiledAt: date });
  },

  clearLogs() {
    set({ compileLog: null, compileErrors: [] });
  },

  resetCompiler() {
    const currentUrl = get().pdfUrl;
    if (currentUrl && currentUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentUrl);
      } catch {
        // Ignore revocation errors
      }
    }
    set({
      pdfUrl: null,
      compileLog: null,
      compileErrors: [],
      compileStatus: 'idle',
      pendingCompile: false,
    });
  },

  setPendingCompile(pending) {
    set({ pendingCompile: pending });
  },

  setIsViewerPoppedOut(poppedOut) {
    if (get().isViewerPoppedOut !== poppedOut) {
      set({ isViewerPoppedOut: poppedOut });
    }
    if (useWorkspaceStore.getState().isPdfDetached !== poppedOut) {
      useWorkspaceStore.getState().setPdfDetached(poppedOut);
    }
  },
}));

// Keep useWorkspaceStore.isPdfDetached and useCompileStore.isViewerPoppedOut bidirectionally synchronized
useWorkspaceStore.subscribe(
  (s) => s.isPdfDetached,
  (isPdfDetached) => {
    if (useCompileStore.getState().isViewerPoppedOut !== isPdfDetached) {
      useCompileStore.setState({ isViewerPoppedOut: isPdfDetached });
    }
  },
);

// Keep useCompileStore.dirtyFileIds and dirtyContentMap reactively synchronized from lruDocumentCache
function syncCompilerDirtyState() {
  const dirtyModels = lruDocumentCache.getDirtyModels();
  const nextDirtyIds = new Set(dirtyModels.map((m) => m.fileId));
  const nextContentMap = new Map(dirtyModels.map((m) => [m.fileId, m.content]));
  const currentState = useCompileStore.getState();

  let idsChanged = nextDirtyIds.size !== currentState.dirtyFileIds.size;
  if (!idsChanged) {
    for (const id of nextDirtyIds) {
      if (!currentState.dirtyFileIds.has(id)) {
        idsChanged = true;
        break;
      }
    }
  }

  let contentChanged = nextContentMap.size !== currentState.dirtyContentMap.size;
  if (!contentChanged) {
    for (const [id, content] of nextContentMap) {
      if (currentState.dirtyContentMap.get(id) !== content) {
        contentChanged = true;
        break;
      }
    }
  }

  if (idsChanged || contentChanged) {
    useCompileStore.setState({
      dirtyFileIds: nextDirtyIds,
      dirtyContentMap: nextContentMap,
    });
  }
}

lruDocumentCache.subscribe(syncCompilerDirtyState);

export type { CompileStatus, CompileError };
