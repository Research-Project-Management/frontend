import { describe, it, expect, beforeEach } from 'vitest';
import { usePageStore } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { useWorkspaceStore } from '@/features/editor/core';
import {
  CANONICAL_MATH_SYMBOLS,
  getModalSymbols,
  getVisualSymbols,
} from '@/features/editor/domain/latex/latex-symbols';
import { buildPageStoreFilePaths } from '@/features/editor/subsystems/compiler';
import {
  IndentGuides,
  InlineInput,
  RenameInput,
  RowActions,
} from '@/features/editor/subsystems/explorer';

describe('Editor Architecture Directness & Clean Design', () => {
  beforeEach(() => {
    usePageStore.getState().resetPageState();
  });

  describe('1. Document State Synchronization (Eliminate currentPage vs activeFilePage split-brain)', () => {
    it('setCurrentPage atomically updates currentPage, activeFilePage, and activePageId', () => {
      const mockDoc = { id: 'file-123', title: 'chapter1.tex', content: '\\chapter{One}' };
      usePageStore.getState().setCurrentPage(mockDoc as any);

      const state = usePageStore.getState();
      expect(state.currentPage).toEqual(mockDoc);
      expect(state.activeFilePage).toEqual(mockDoc);
      expect(state.activePageId).toBe('file-123');
      expect(state.getActiveDocument()).toEqual(mockDoc);
      expect(state.getActiveDocumentId()).toBe('file-123');
      expect(state.getActiveDocumentTitle()).toBe('chapter1.tex');
    });

    it('setActiveFilePage atomically updates currentPage, activeFilePage, and activePageId', () => {
      const mockDoc = { id: 'file-456', title: 'appendix.tex', content: '\\section{App}' };
      usePageStore.getState().setActiveFilePage(mockDoc as any);

      const state = usePageStore.getState();
      expect(state.currentPage).toEqual(mockDoc);
      expect(state.activeFilePage).toEqual(mockDoc);
      expect(state.activePageId).toBe('file-456');
    });

    it('setActiveDocument updates both pointers simultaneously', () => {
      const mockDoc = { id: 'main-doc', title: 'main.tex', content: '\\documentclass{article}' };
      usePageStore.getState().setActiveDocument(mockDoc as any);

      const state = usePageStore.getState();
      expect(state.currentPage).toEqual(mockDoc);
      expect(state.activeFilePage).toEqual(mockDoc);
      expect(state.activePageId).toBe('main-doc');
    });
  });

  describe('2. Layout & Settings Store Boundary Separation', () => {
    it('Layout store is the sole source of truth for sidebar and review pane', () => {
      const layout = useWorkspaceStore.getState();
      expect(layout.activeSidebarTab).toBeDefined();
      expect(layout.sidebarLeftOpen).toBeDefined();

      layout.setActiveSidebarTab('files');
      expect(useWorkspaceStore.getState().activeSidebarTab).toBe('files');

      layout.selectActivityTab('review');
      expect(useWorkspaceStore.getState().activeSidebarTab).toBe('review');
    });

    it('Settings store does not contain zombie activeSidebarPanel or isReviewOpen', () => {
      const settings = useSettingsStore.getState();
      expect((settings as any).activeSidebarPanel).toBeUndefined();
      expect((settings as any).sidebarWidth).toBeUndefined();
      expect((settings as any).editorFlex).toBeUndefined();
      expect((settings as any).isReviewOpen).toBeUndefined();
    });
  });

  describe('3. Canonical LaTeX Symbols Single Source of Truth', () => {
    it('CANONICAL_MATH_SYMBOLS contains all necessary symbols without duplication', () => {
      expect(CANONICAL_MATH_SYMBOLS.length).toBeGreaterThan(50);
      const ids = CANONICAL_MATH_SYMBOLS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('getModalSymbols formats symbols for modal palette', () => {
      const modalSymbols = getModalSymbols();
      expect(modalSymbols.length).toBe(CANONICAL_MATH_SYMBOLS.length);
      expect(modalSymbols[0]).toHaveProperty('command');
      expect(modalSymbols[0]).toHaveProperty('display');
      expect(modalSymbols[0]).toHaveProperty('name');
      expect(modalSymbols[0]).toHaveProperty('category');
    });

    it('getVisualSymbols formats symbols for visual editor palette', () => {
      const visualSymbols = getVisualSymbols();
      expect(visualSymbols.length).toBe(CANONICAL_MATH_SYMBOLS.length);
      expect(visualSymbols[0]).toHaveProperty('id');
      expect(visualSymbols[0]).toHaveProperty('latex');
      expect(visualSymbols[0]).toHaveProperty('previewLatex');
      expect(visualSymbols[0]).toHaveProperty('keywords');
    });
  });

  describe('4. Compiler Coordinator Pure Snapshot Assembly', () => {
    it('buildPageStoreFilePaths extracts paths from activeFilePage, currentPage, and hierarchy', () => {
      const paths = buildPageStoreFilePaths({
        currentPage: { id: 'p1', title: 'intro.tex' },
        activeFilePage: { id: 'p2', title: 'body.tex' },
        fileHierarchy: [
          {
            id: 'f1',
            title: 'chapters',
            children: [{ id: 'c1', title: 'chap1.tex' }],
          } as any,
        ],
      });

      expect(paths['p1']).toBe('intro.tex');
      expect(paths['p2']).toBe('body.tex');
      expect(paths['f1']).toBe('chapters');
      expect(paths['c1']).toBe('chap1.tex');
    });
  });

  describe('5. File Tree Primitives are defined and exported', () => {
    it('exports all pure micro-components cleanly', () => {
      expect(IndentGuides).toBeDefined();
      expect(InlineInput).toBeDefined();
      expect(RenameInput).toBeDefined();
      expect(RowActions).toBeDefined();
    });
  });
});
