/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and file hierarchy.
 * Zero mutable refs. Pure reactive state.
 */

import { create } from 'zustand';
import type { AssetInfo } from '../types/asset.types';

export interface DocumentEditorState {
  // ── Document & Project State ─────────────────────────────────────────────
  currentPage: any | null;
  projectId: string;
  parentPageId: string | null;
  activePageId: string | null;
  fileHierarchy: any | null;
  activeFilePage: any | null;
  selectedAsset: AssetInfo | null;
  texFiles: string[];

  // ── Setters & Actions ───────────────────────────────────────────────────
  setCurrentPage: (page: any) => void;
  setProjectId: (id: string) => void;
  setParentPageId: (id: string | null) => void;
  setActivePageId: (id: string | null) => void;
  setFileHierarchy: (hierarchy: any) => void;
  setActiveFilePage: (page: any) => void;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  setTexFiles: (files: string[]) => void;
  resetPageState: () => void;
}

export const useDocumentEditorStore = create<DocumentEditorState>((set) => ({
  currentPage: null,
  projectId: '',
  parentPageId: null,
  activePageId: null,
  fileHierarchy: null,
  activeFilePage: null,
  selectedAsset: null,
  texFiles: [],

  setCurrentPage: (page) => set({ currentPage: page }),
  setProjectId: (projectId) => set({ projectId }),
  setParentPageId: (parentPageId) => set({ parentPageId }),
  setActivePageId: (activePageId) => set({ activePageId }),
  setFileHierarchy: (fileHierarchy) => set({ fileHierarchy }),
  setActiveFilePage: (activeFilePage) => set({ activeFilePage }),
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
}));

// Aliases for seamless backward compatibility
export const usePageStore = useDocumentEditorStore;
export const useEditorPageStore = useDocumentEditorStore;
export const useEditorStore = useDocumentEditorStore;
export const usePageContext = useDocumentEditorStore;
export type { AssetInfo };
