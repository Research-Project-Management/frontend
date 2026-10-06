/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and file hierarchy.
 * Zero mutable refs. Pure reactive state.
 */

import { create } from 'zustand';
import type { AssetInfo } from '../types/asset.types';
import type { Page, PageFile } from '../types/core.types';
import type { NodeTreeItem } from '../types/node.types';

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
  setCurrentPage: (page: Page | PageFile | null | ((prev: any) => any)) => void;
  setProjectId: (id: string) => void;
  setParentPageId: (id: string | null) => void;
  setActivePageId: (id: string | null) => void;
  setFileHierarchy: (hierarchy: any) => void;
  setActiveFilePage: (page: Page | PageFile | null) => void;
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

  setCurrentPage: (pageOrUpdater) =>
    set((state) => ({
      currentPage:
        typeof pageOrUpdater === 'function'
          ? (pageOrUpdater as any)(state.currentPage)
          : pageOrUpdater,
    })),
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
