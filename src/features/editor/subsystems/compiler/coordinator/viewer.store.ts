/**
 * viewer.store.ts
 *
 * Store for PDF Viewer state, page navigation, responsive zoom, color inversion, and view modes (State Layer).
 * Centralizes viewer state so detached popout windows, tab switches, and toolbar controls share a single source of truth.
 */

import { create } from 'zustand';

export type PdfFitMode = 'width' | 'height' | 'auto';

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

  // ── Actions ─────────────────────────────────────────────────────────────
  setPageNumber: (page: number | ((prev: number) => number)) => void;
  nextPage: () => void;
  prevPage: () => void;
  setNumPages: (numPages: number) => void;

  setScale: (scale: number, disableAutoFit?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setAutoFit: (autoFit: boolean) => void;
  setFitMode: (fitMode: PdfFitMode) => void;

  toggleInvertColors: () => void;
  setInvertColors: (invert: boolean) => void;
  toggleSpreadView: () => void;
  setSpreadView: (spread: boolean) => void;

  resetViewerState: () => void;
}

export const useViewerStore = create<DocumentViewerState>((set) => ({
  pageNumber: 1,
  numPages: 1,

  scale: 1.0,
  autoFit: true,
  fitMode: 'width',

  invertColors: false,
  isSpreadView: false,

  setPageNumber: (pageOrFn) =>
    set((s) => {
      const pageNumber = typeof pageOrFn === 'function' ? pageOrFn(s.pageNumber) : pageOrFn;
      const next = Math.max(1, Math.min(pageNumber, s.numPages || 1));
      if (s.pageNumber === next) return s;
      return {
        pageNumber: next,
      };
    }),

  nextPage: () =>
    set((s) => {
      const next = Math.min(s.pageNumber + 1, s.numPages || 1);
      if (s.pageNumber === next) return s;
      return { pageNumber: next };
    }),

  prevPage: () =>
    set((s) => {
      const next = Math.max(s.pageNumber - 1, 1);
      if (s.pageNumber === next) return s;
      return { pageNumber: next };
    }),

  setNumPages: (numPages) =>
    set((s) => {
      const safeTotal = Math.max(1, numPages);
      const nextPageNumber = Math.min(s.pageNumber, safeTotal);
      if (s.numPages === safeTotal && s.pageNumber === nextPageNumber) return s;
      return {
        numPages: safeTotal,
        pageNumber: nextPageNumber,
      };
    }),

  setScale: (scale, disableAutoFit = true) =>
    set((s) => {
      const nextScale = Math.max(0.25, Math.min(scale, 4.0));
      const nextAutoFit = disableAutoFit ? false : s.autoFit;
      if (Math.abs(s.scale - nextScale) < 0.0001 && s.autoFit === nextAutoFit) {
        return s;
      }
      return {
        scale: nextScale,
        ...(disableAutoFit ? { autoFit: false } : {}),
      };
    }),

  zoomIn: () =>
    set((s) => {
      const nextScale = Math.min(Number((s.scale + 0.15).toFixed(2)), 4.0);
      if (s.scale === nextScale && !s.autoFit) return s;
      return {
        scale: nextScale,
        autoFit: false,
      };
    }),

  zoomOut: () =>
    set((s) => {
      const nextScale = Math.max(Number((s.scale - 0.15).toFixed(2)), 0.25);
      if (s.scale === nextScale && !s.autoFit) return s;
      return {
        scale: nextScale,
        autoFit: false,
      };
    }),

  resetZoom: () =>
    set((s) => {
      if (s.scale === 1.0 && s.autoFit && s.fitMode === 'width') return s;
      return {
        scale: 1.0,
        autoFit: true,
        fitMode: 'width',
      };
    }),

  setAutoFit: (autoFit) =>
    set((s) => (s.autoFit === autoFit ? s : { autoFit })),
  setFitMode: (fitMode) =>
    set((s) => (s.fitMode === fitMode && s.autoFit ? s : { fitMode, autoFit: true })),

  toggleInvertColors: () => set((s) => ({ invertColors: !s.invertColors })),
  setInvertColors: (invertColors) =>
    set((s) => (s.invertColors === invertColors ? s : { invertColors })),

  toggleSpreadView: () => set((s) => ({ isSpreadView: !s.isSpreadView })),
  setSpreadView: (isSpreadView) =>
    set((s) => (s.isSpreadView === isSpreadView ? s : { isSpreadView })),

  resetViewerState: () =>
    set({
      pageNumber: 1,
      numPages: 1,
      scale: 1.0,
      autoFit: true,
      fitMode: 'width',
      invertColors: false,
      isSpreadView: false,
    }),
}));
