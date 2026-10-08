/**
 * viewer.store.ts
 *
 * Store for PDF Viewer state, page navigation, responsive zoom, color inversion, and view modes (State Layer).
 * Centralizes viewer state so detached popout windows, tab switches, and toolbar controls share a single source of truth.
 */

import { create } from 'zustand';

export type PdfFitMode = 'width' | 'height' | 'auto';
export type PdfRotation = 0 | 90 | 180 | 270;

export interface DocumentViewerState {
  // ── Pagination ──────────────────────────────────────────────────────────
  pageNumber: number;
  numPages: number;

  // ── Zoom & Scaling ──────────────────────────────────────────────────────
  scale: number;
  autoFit: boolean;
  fitMode: PdfFitMode;

  // ── Presentation & Visuals ──────────────────────────────────────────────
  invertColors: boolean;
  isSpreadView: boolean;
  pageRotation: PdfRotation;

  // ── In-PDF Search ───────────────────────────────────────────────────────
  isFindBarOpen: boolean;
  findQuery: string;
  findMatchesCount: { current: number; total: number };

  // ── Actions ─────────────────────────────────────────────────────────────
  setPageNumber: (page: number | ((prev: number) => number)) => void;
  nextPage: () => void;
  prevPage: () => void;
  setNumPages: (numPages: number) => void;

  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setAutoFit: (autoFit: boolean) => void;
  setFitMode: (fitMode: PdfFitMode) => void;

  toggleInvertColors: () => void;
  setInvertColors: (invert: boolean) => void;
  toggleSpreadView: () => void;
  setSpreadView: (spread: boolean) => void;
  rotateClockwise: () => void;
  setPageRotation: (rotation: PdfRotation) => void;

  setIsFindBarOpen: (open: boolean) => void;
  toggleFindBar: () => void;
  setFindQuery: (query: string) => void;
  setFindMatchesCount: (counts: { current: number; total: number }) => void;

  resetViewerState: () => void;
}

export const useDocumentViewerStore = create<DocumentViewerState>((set) => ({
  pageNumber: 1,
  numPages: 1,

  scale: 1.0,
  autoFit: true,
  fitMode: 'width',

  invertColors: false,
  isSpreadView: false,
  pageRotation: 0,

  isFindBarOpen: false,
  findQuery: '',
  findMatchesCount: { current: 0, total: 0 },

  setPageNumber: (pageOrFn) =>
    set((s) => {
      const pageNumber = typeof pageOrFn === 'function' ? pageOrFn(s.pageNumber) : pageOrFn;
      return {
        pageNumber: Math.max(1, Math.min(pageNumber, s.numPages || 1)),
      };
    }),

  nextPage: () =>
    set((s) => ({
      pageNumber: Math.min(s.pageNumber + 1, s.numPages || 1),
    })),

  prevPage: () =>
    set((s) => ({
      pageNumber: Math.max(s.pageNumber - 1, 1),
    })),

  setNumPages: (numPages) =>
    set((s) => {
      const safeTotal = Math.max(1, numPages);
      return {
        numPages: safeTotal,
        pageNumber: Math.min(s.pageNumber, safeTotal),
      };
    }),

  setScale: (scale) =>
    set({
      scale: Math.max(0.25, Math.min(scale, 4.0)),
      autoFit: false,
    }),

  zoomIn: () =>
    set((s) => ({
      scale: Math.min(Number((s.scale + 0.15).toFixed(2)), 4.0),
      autoFit: false,
    })),

  zoomOut: () =>
    set((s) => ({
      scale: Math.max(Number((s.scale - 0.15).toFixed(2)), 0.25),
      autoFit: false,
    })),

  resetZoom: () =>
    set({
      scale: 1.0,
      autoFit: true,
      fitMode: 'width',
    }),

  setAutoFit: (autoFit) => set({ autoFit }),
  setFitMode: (fitMode) => set({ fitMode, autoFit: true }),

  toggleInvertColors: () => set((s) => ({ invertColors: !s.invertColors })),
  setInvertColors: (invertColors) => set({ invertColors }),

  toggleSpreadView: () => set((s) => ({ isSpreadView: !s.isSpreadView })),
  setSpreadView: (isSpreadView) => set({ isSpreadView }),

  rotateClockwise: () =>
    set((s) => {
      const nextRotation = ((s.pageRotation + 90) % 360) as PdfRotation;
      return { pageRotation: nextRotation };
    }),

  setPageRotation: (pageRotation) => set({ pageRotation }),

  setIsFindBarOpen: (isFindBarOpen) => set({ isFindBarOpen }),
  toggleFindBar: () => set((s) => ({ isFindBarOpen: !s.isFindBarOpen })),
  setFindQuery: (findQuery) => set({ findQuery }),
  setFindMatchesCount: (findMatchesCount) => set({ findMatchesCount }),

  resetViewerState: () =>
    set({
      pageNumber: 1,
      numPages: 1,
      scale: 1.0,
      autoFit: true,
      fitMode: 'width',
      invertColors: false,
      isSpreadView: false,
      pageRotation: 0,
      isFindBarOpen: false,
      findQuery: '',
      findMatchesCount: { current: 0, total: 0 },
    }),
}));

export const useViewerStore = useDocumentViewerStore;
