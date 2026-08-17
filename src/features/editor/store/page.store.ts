import { create } from "zustand";
import type { editor } from "monaco-editor";

export interface AssetInfo {
  _id?: string;
  url?: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

export interface RefHolder<T> {
  current: T;
}

interface PageState {
  // ── Document & Project State ─────────────────────────────────────────────
  currentPage: any | null;
  workspaceId: string;
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
  setWorkspaceId: (id: string) => void;
  setActiveFilePage: (page: any) => void;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  setTexFiles: (files: string[]) => void;
  resetPageState: () => void;
}

export const usePageStore = create<PageState>((set) => ({
  currentPage: null,
  workspaceId: "",
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
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
  setActiveFilePage: (activeFilePage) => set({ activeFilePage }),
  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
  setTexFiles: (texFiles) => set({ texFiles }),
  resetPageState: () =>
    set({
      currentPage: null,
      workspaceId: "",
      activeFilePage: null,
      selectedAsset: null,
      texFiles: [],
    }),
}));

/** @deprecated alias for backward compatibility */
export const useEditorPageStore = usePageStore;
export const usePageContext = usePageStore;
