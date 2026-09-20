/**
 * compiler.store.ts
 *
 * Store for LaTeX compilation lifecycle, incremental dirty-file tracking, and diagnostic logs.
 */

import { create } from 'zustand';
import type { CompileStatus, CompileError } from '../types/compiler.types';

export interface DocumentCompilerState {
  // ── Dirty content tracking ─────────────────────────────────────────────
  /** fileId → latest editor content (updated on every keystroke, debounced ~300ms) */
  dirtyContentMap: Map<string, string>;
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
  setPendingCompile: (pending: boolean) => void;
  setIsViewerPoppedOut: (poppedOut: boolean) => void;
}

export const useDocumentCompilerStore = create<DocumentCompilerState>()((set, get) => ({
  // ── Dirty tracking ────────────────────────────────────────────────────
  dirtyContentMap: new Map(),

  markDirty(fileId, content) {
    set((s) => {
      const next = new Map(s.dirtyContentMap);
      next.set(fileId, content);
      return { dirtyContentMap: next };
    });
  },

  clearDirty(fileId) {
    set((s) => {
      const next = new Map(s.dirtyContentMap);
      next.delete(fileId);
      return { dirtyContentMap: next };
    });
  },

  clearAllDirty() {
    set({ dirtyContentMap: new Map() });
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
    // Revoke the old blob URL before setting the new one to prevent memory leaks
    const prev = get().pdfUrl;
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    set({ pdfUrl: url });
  },

  setLastCompiledAt(date) {
    set({ lastCompiledAt: date });
  },

  setPendingCompile(pending) {
    set({ pendingCompile: pending });
  },

  setIsViewerPoppedOut(poppedOut) {
    set({ isViewerPoppedOut: poppedOut });
  },
}));

// Aliases for seamless backward compatibility
export const useCompileStore = useDocumentCompilerStore;
export const useCompilerStore = useDocumentCompilerStore;
export type { CompileStatus, CompileError };
