/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and imperative Monaco/PDF viewer bridge refs.
 */

import { create } from 'zustand';
import type { editor } from 'monaco-editor';
import type { AssetInfo } from '../types/asset.types';

export interface RefHolder<T> {
  current: T;
}

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

  // ── Imperative Bridge Refs (Monaco & Compiler) ───────────────────────────
  editorRef: RefHolder<editor.IStandaloneCodeEditor | null>;
  getEditorContent: RefHolder<(() => string) | null>;
  compileRef: RefHolder<(() => void) | null>;
  scrollToLineRef: RefHolder<((line: number) => void) | null>;
  scrollToPdfLineRef: RefHolder<((line: number, fileTag?: number) => void) | null>;
  gotoPageRef: RefHolder<((page: number) => void) | null>;
  pdfDocRef: RefHolder<any | null>;
  isAiPreviewingRef: RefHolder<boolean>;

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

  editorRef: { current: null },
  getEditorContent: { current: null },
  compileRef: { current: null },
  scrollToLineRef: { current: null },
  scrollToPdfLineRef: { current: null },
  gotoPageRef: { current: null },
  pdfDocRef: { current: null },
  isAiPreviewingRef: { current: false },

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
export const usePageContext = useDocumentEditorStore;
export type { AssetInfo };
