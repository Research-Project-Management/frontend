/**
 * compiler.store.ts
 *
 * Store for LaTeX compilation lifecycle, incremental dirty-file tracking, and diagnostic logs.
 */

import { create } from 'zustand';
import type { CompileStatus, CompileError } from '@/features/editor/domain/types/compiler.types';

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
  // ── Dirty tracking ────────────────────────────────────────────────────
  dirtyContentMap: new Map(),
  dirtyFileIds: new Set(),

  isDirtyFile(fileId: string) {
    return get().dirtyFileIds.has(fileId);
  },

  markDirty(fileId, content) {
    set((s) => {
      if (s.dirtyFileIds.has(fileId) && s.dirtyContentMap.get(fileId) === content) {
        return s;
      }
      const nextDirtyFileIds = new Set(s.dirtyFileIds);
      nextDirtyFileIds.add(fileId);
      const nextMap = new Map(s.dirtyContentMap);
      nextMap.set(fileId, content);
      return {
        dirtyContentMap: nextMap,
        dirtyFileIds: nextDirtyFileIds,
      };
    });
  },

  clearDirty(fileId) {
    set((s) => {
      if (!s.dirtyFileIds.has(fileId) && !s.dirtyContentMap.has(fileId)) return s;
      const nextDirtyFileIds = new Set(s.dirtyFileIds);
      nextDirtyFileIds.delete(fileId);
      const nextMap = new Map(s.dirtyContentMap);
      nextMap.delete(fileId);
      return {
        dirtyContentMap: nextMap,
        dirtyFileIds: nextDirtyFileIds,
      };
    });
  },

  clearAllDirty() {
    set({
      dirtyContentMap: new Map(),
      dirtyFileIds: new Set(),
    });
  },

  getDirtyFiles() {
    return Array.from(get().dirtyContentMap.entries()).map(
      ([fileId, content]) => ({ fileId, content }),
    );
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
    set({ compileLog: log });
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
    set({ isViewerPoppedOut: poppedOut });
  },
}));

export type { CompileStatus, CompileError };
