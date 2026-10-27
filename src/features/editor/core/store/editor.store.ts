/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and file hierarchy.
 * Zero mutable refs. Pure reactive state.
 */

import { create } from 'zustand';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';

export interface DocumentEditorState {
  // ── Document & Project Hierarchy (projectId -> pageId (rootPageId) -> activeDocId) ──
  projectId: string;
  rootPageId: string | null;
  activeDocId: string | null;

  // Backward-compatible aliases
  parentPageId: string | null;
  activePageId: string | null;

  currentPage: Page | PageFile | null;
  activeFilePage: Page | PageFile | null;
  selectedAsset: AssetInfo | null;

  // ── Setters & Actions ───────────────────────────────────────────────────
  setCurrentPage: (page: Page | PageFile | null | ((prev: Page | PageFile | null) => Page | PageFile | null)) => void;
  setProjectId: (id: string) => void;
  setRootPageId: (id: string | null) => void;
  setParentPageId: (id: string | null) => void;
  setActiveDocId: (id: string | null) => void;
  setActivePageId: (id: string | null) => void;
  setHierarchy: (hierarchy: {
    projectId?: string;
    rootPageId?: string | null;
    pageId?: string | null;
    activeDocId?: string | null;
  }) => void;
  setActiveFilePage: (page: Page | PageFile | null) => void;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  resetPageState: () => void;

  // ── Canonical Manuscript & LaTeX Accessors (Overleaf Parity) ────────────
  getActiveDocument: () => Page | PageFile | null;
  getActiveDocumentId: () => string | null;
  getActiveDocumentTitle: () => string;
  setActiveDocument: (doc: Page | PageFile | null) => void;
  getProjectId: () => string;
  getRootPageId: () => string | null;
  getActiveDocId: () => string | null;
}

export const usePageStore = create<DocumentEditorState>((set, get) => ({
  currentPage: null,
  projectId: '',
  rootPageId: null,
  parentPageId: null,
  activeDocId: null,
  activePageId: null,
  activeFilePage: null,
  selectedAsset: null,

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
      const nextParentPageId = state.parentPageId || state.rootPageId || next?.id || null;
      const nextActiveFilePage = hasDistinctActiveFile ? state.activeFilePage : next;
      const nextActivePageId = hasDistinctActiveFile ? state.activeFilePage?.id || null : next?.id || null;
      if (
        state.currentPage === next &&
        state.parentPageId === nextParentPageId &&
        state.rootPageId === nextParentPageId &&
        state.activeFilePage === nextActiveFilePage &&
        state.activePageId === nextActivePageId &&
        state.activeDocId === nextActivePageId
      ) {
        return state;
      }
      return {
        currentPage: next,
        rootPageId: nextParentPageId,
        parentPageId: nextParentPageId,
        activeFilePage: nextActiveFilePage,
        activeDocId: nextActivePageId,
        activePageId: nextActivePageId,
      };
    }),
  setProjectId: (projectId) =>
    set((state) => (state.projectId === projectId ? state : { projectId })),
  setRootPageId: (rootPageId) =>
    set((state) =>
      state.rootPageId === rootPageId && state.parentPageId === rootPageId
        ? state
        : { rootPageId, parentPageId: rootPageId },
    ),
  setParentPageId: (parentPageId) =>
    set((state) =>
      state.rootPageId === parentPageId && state.parentPageId === parentPageId
        ? state
        : { rootPageId: parentPageId, parentPageId },
    ),
  setActiveDocId: (activeDocId) =>
    set((state) =>
      state.activeDocId === activeDocId && state.activePageId === activeDocId
        ? state
        : { activeDocId, activePageId: activeDocId },
    ),
  setActivePageId: (activePageId) =>
    set((state) =>
      state.activeDocId === activePageId && state.activePageId === activePageId
        ? state
        : { activeDocId: activePageId, activePageId },
    ),
  setHierarchy: ({ projectId, rootPageId, pageId, activeDocId }) =>
    set((state) => {
      const resolvedProjectId = projectId !== undefined ? projectId : state.projectId;
      const resolvedRoot =
        rootPageId !== undefined ? rootPageId : pageId !== undefined ? pageId : state.rootPageId;
      const resolvedActive = activeDocId !== undefined ? activeDocId : state.activeDocId;
      return {
        projectId: resolvedProjectId,
        rootPageId: resolvedRoot,
        parentPageId: resolvedRoot,
        activeDocId: resolvedActive,
        activePageId: resolvedActive,
      };
    }),
  setActiveFilePage: (activeFilePage) =>
    set((state) => {
      const nextActivePageId = (activeFilePage ?? state.currentPage)?.id || null;
      if (
        state.activeFilePage === activeFilePage &&
        state.activePageId === nextActivePageId &&
        state.activeDocId === nextActivePageId
      ) {
        return state;
      }
      return {
        activeFilePage,
        activeDocId: nextActivePageId,
        activePageId: nextActivePageId,
      };
    }),
  setSelectedAsset: (selectedAsset) =>
    set((state) => (state.selectedAsset === selectedAsset ? state : { selectedAsset })),
  resetPageState: () =>
    set({
      currentPage: null,
      projectId: '',
      rootPageId: null,
      parentPageId: null,
      activeDocId: null,
      activePageId: null,
      activeFilePage: null,
      selectedAsset: null,
    }),

  // ── Canonical Manuscript Accessor Implementations ───────────────────────
  getActiveDocument: () => get().activeFilePage || get().currentPage,
  getActiveDocumentId: () => get().activeDocId || get().activePageId || (get().activeFilePage || get().currentPage)?.id || null,
  getActiveDocumentTitle: () => (get().activeFilePage || get().currentPage)?.title || 'main.tex',
  setActiveDocument: (doc) =>
    set((state) => {
      const nextDocId = (doc ?? state.currentPage)?.id || null;
      return {
        activeFilePage: doc,
        activeDocId: nextDocId,
        activePageId: nextDocId,
        currentPage: state.currentPage ?? doc,
      };
    }),
  getProjectId: () => get().projectId,
  getRootPageId: () => get().rootPageId || get().parentPageId,
  getActiveDocId: () => get().activeDocId || get().activePageId,
}));

export type { AssetInfo };
