/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and file hierarchy.
 * Zero mutable refs. Pure reactive state.
 */

import { create } from 'zustand';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';

export interface DocumentEditorState {
  // ── Document & Project State ─────────────────────────────────────────────
  currentPage: Page | PageFile | null;
  projectId: string;
  parentPageId: string | null;
  activePageId: string | null;
  fileHierarchy: NodeTreeItem[] | null;
  activeFilePage: Page | PageFile | null;
  selectedAsset: AssetInfo | null;
  texFiles: string[];

  // ── Setters & Actions ───────────────────────────────────────────────────
  setCurrentPage: (page: Page | PageFile | null | ((prev: Page | PageFile | null) => Page | PageFile | null)) => void;
  setProjectId: (id: string) => void;
  setParentPageId: (id: string | null) => void;
  setActivePageId: (id: string | null) => void;
  setFileHierarchy: (hierarchy: NodeTreeItem[] | null) => void;
  setActiveFilePage: (page: Page | PageFile | null) => void;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  setTexFiles: (files: string[]) => void;
  resetPageState: () => void;

  // ── Canonical Manuscript & LaTeX Accessors (Overleaf Parity) ────────────
  getActiveDocument: () => Page | PageFile | null;
  getActiveDocumentId: () => string | null;
  getActiveDocumentTitle: () => string;
  setActiveDocument: (doc: Page | PageFile | null) => void;
}

export const usePageStore = create<DocumentEditorState>((set, get) => ({
  currentPage: null,
  projectId: '',
  parentPageId: null,
  activePageId: null,
  fileHierarchy: null,
  activeFilePage: null,
  selectedAsset: null,
  texFiles: [],

  setCurrentPage: (pageOrUpdater) =>
    set((state) => {
      const next =
        typeof pageOrUpdater === 'function'
          ? pageOrUpdater(state.currentPage)
          : pageOrUpdater;
      const hasDistinctActiveFile =
        state.activeFilePage &&
        next &&
        state.activeFilePage.id !== state.currentPage?.id &&
        state.activeFilePage.id !== next.id;
      return {
        currentPage: next,
        parentPageId: state.parentPageId || next?.id || null,
        activeFilePage: hasDistinctActiveFile ? state.activeFilePage : next,
        activePageId: hasDistinctActiveFile ? state.activeFilePage?.id || null : next?.id || null,
      };
    }),
  setProjectId: (projectId) => set({ projectId }),
  setParentPageId: (parentPageId) => set({ parentPageId }),
  setActivePageId: (activePageId) => set({ activePageId }),
  setFileHierarchy: (fileHierarchy) => set({ fileHierarchy }),
  setActiveFilePage: (activeFilePage) =>
    set((state) => ({
      activeFilePage,
      currentPage: activeFilePage ?? state.currentPage,
      activePageId: (activeFilePage ?? state.currentPage)?.id || null,
    })),
  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
  setTexFiles: (texFiles) => set({ texFiles }),
  resetPageState: () =>
    set({
      currentPage: null,
      projectId: '',
      parentPageId: null,
      activePageId: null,
      fileHierarchy: null,
      activeFilePage: null,
      selectedAsset: null,
      texFiles: [],
    }),

  // ── Canonical Manuscript Accessor Implementations ───────────────────────
  getActiveDocument: () => get().activeFilePage || get().currentPage,
  getActiveDocumentId: () => (get().activeFilePage || get().currentPage)?.id || null,
  getActiveDocumentTitle: () => (get().activeFilePage || get().currentPage)?.title || 'main.tex',
  setActiveDocument: (doc) => {
    set({
      activeFilePage: doc,
      activePageId: doc?.id || null,
      currentPage: doc,
    });
  },
}));

export type { AssetInfo };
