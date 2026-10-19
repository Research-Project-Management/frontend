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

  setScale: (scale, disableAutoFit = true) =>
    set({
      scale: Math.max(0.25, Math.min(scale, 4.0)),
      ...(disableAutoFit ? { autoFit: false } : {}),
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
