/**
 * search.store.ts
 *
 * Store for project-wide and in-file search & replace state (State Layer).
 * Persists active query, replacement text, regex/case options, and collapsed files across sidebar tab switches.
 */

import { create } from 'zustand';

export interface DocumentSearchState {
  // ── Search & Replace Inputs ─────────────────────────────────────────────
  query: string;
  instantQuery: string | null;
  replaceText: string;
  showReplace: boolean;

  // ── Options Flags ───────────────────────────────────────────────────────
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;

  // ── UI View State ───────────────────────────────────────────────────────
  collapsedFiles: Set<string>;
  isSearching: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────
  setQuery: (query: string) => void;
  setInstantQuery: (instant: string | null) => void;
  setReplaceText: (replaceText: string) => void;
  setShowReplace: (show: boolean) => void;
  toggleShowReplace: () => void;

  setCaseSensitive: (val: boolean) => void;
  toggleCaseSensitive: () => void;
  setWholeWord: (val: boolean) => void;
  toggleWholeWord: () => void;
  setUseRegex: (val: boolean) => void;
  toggleUseRegex: () => void;

  toggleFileCollapsed: (fileId: string) => void;
  collapseAllFiles: (fileIds: string[]) => void;
  expandAllFiles: () => void;
  setIsSearching: (isSearching: boolean) => void;
  clearSearch: () => void;
}

export const useDocumentSearchStore = create<DocumentSearchState>((set) => ({
  query: '',
  instantQuery: null,
  replaceText: '',
  showReplace: false,

  caseSensitive: false,
  wholeWord: false,
  useRegex: false,

  collapsedFiles: new Set<string>(),
  isSearching: false,

  setQuery: (query) => set({ query, instantQuery: null }),
  setInstantQuery: (instantQuery) => set({ instantQuery }),
  setReplaceText: (replaceText) => set({ replaceText }),
  setShowReplace: (showReplace) => set({ showReplace }),
  toggleShowReplace: () => set((s) => ({ showReplace: !s.showReplace })),

  setCaseSensitive: (caseSensitive) => set({ caseSensitive }),
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  setWholeWord: (wholeWord) => set({ wholeWord }),
  toggleWholeWord: () => set((s) => ({ wholeWord: !s.wholeWord })),
  setUseRegex: (useRegex) => set({ useRegex }),
  toggleUseRegex: () => set((s) => ({ useRegex: !s.useRegex })),

  toggleFileCollapsed: (fileId) =>
    set((s) => {
      const next = new Set(s.collapsedFiles);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return { collapsedFiles: next };
    }),

  collapseAllFiles: (fileIds) => set({ collapsedFiles: new Set(fileIds) }),
  expandAllFiles: () => set({ collapsedFiles: new Set() }),
  setIsSearching: (isSearching) => set({ isSearching }),
  clearSearch: () =>
    set({
      query: '',
      instantQuery: null,
      replaceText: '',
      collapsedFiles: new Set(),
      isSearching: false,
    }),
}));

export const useSearchStore = useDocumentSearchStore;
