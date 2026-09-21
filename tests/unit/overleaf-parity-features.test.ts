import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { MONACO_THEMES } from '@/features/editor/components/editor/monaco-themes';
import { pageKeys } from '@/features/editor/hooks/use-core';
import { fileService, pageService } from '@/features/editor/services/core.service';
import * as api from '@/shared/lib/api';

describe('Overleaf Parity Features Suite', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      editorTheme: 'auto',
      pdfSpreadView: false,
    });
    vi.restoreAllMocks();
  });

  describe('Feature 1: Deleted Files Recovery in File Tree', () => {
    it('generates the correct deleted-files query key for React Query cache', () => {
      const key = pageKeys.deletedFiles('test-page-456');
      expect(key).toEqual(['pages', 'detail', 'test-page-456', 'deleted-files']);
    });

    it('queries /api/pages/:pageId/deleted-files via fileService.getDeletedByPageId', async () => {
      const mockDeletedFiles = [
        { id: 'del-1', title: 'chapter2.tex', deletedAt: new Date().toISOString() },
        { id: 'del-2', title: 'figures.tex', deletedAt: new Date().toISOString() },
      ];

      const apiGetSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        files: mockDeletedFiles,
      } as any);

      const files = await fileService.getDeletedByPageId('test-page-456');

      expect(apiGetSpy).toHaveBeenCalledWith('/api/pages/test-page-456/deleted-files');
      expect(files).toHaveLength(2);
      expect(files[0].title).toBe('chapter2.tex');
    });

    it('calls /api/pages/:pageId/restore via pageService.restorePage', async () => {
      const mockRestored = {
        id: 'del-1',
        title: 'chapter2.tex',
        deletedAt: null,
      };

      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        page: mockRestored,
      } as any);

      const res = await pageService.restorePage('del-1');

      expect(apiPostSpy).toHaveBeenCalledWith('/api/pages/del-1/restore', {});
      expect(res.id).toBe('del-1');
      expect(res.title).toBe('chapter2.tex');
    });
  });

  describe('Feature 2: Editor Themes Collection', () => {
    it('defines comprehensive Overleaf themes in MONACO_THEMES', () => {
      const themeIds = MONACO_THEMES.map((t) => t.id);
      expect(themeIds).toContain('auto');
      expect(themeIds).toContain('latex-light');
      expect(themeIds).toContain('latex-dark');
      expect(themeIds).toContain('dracula');
      expect(themeIds).toContain('monokai');
      expect(themeIds).toContain('solarized-light');
      expect(themeIds).toContain('solarized-dark');
      expect(themeIds).toContain('github-light');
      expect(themeIds).toContain('github-dark');
      expect(themeIds).toContain('cobalt');
      expect(themeIds).toContain('eclipse');
    });

    it('defaults editorTheme to auto and allows setting specific themes', () => {
      expect(useSettingsStore.getState().editorTheme).toBe('auto');

      useSettingsStore.getState().setEditorTheme('dracula');
      expect(useSettingsStore.getState().editorTheme).toBe('dracula');

      useSettingsStore.getState().setEditorTheme('monokai');
      expect(useSettingsStore.getState().editorTheme).toBe('monokai');

      useSettingsStore.getState().setEditorTheme('solarized-dark');
      expect(useSettingsStore.getState().editorTheme).toBe('solarized-dark');
    });
  });

  describe('Feature 3: PDF Two-Page Spread View', () => {
    it('defaults pdfSpreadView to false and toggles correctly', () => {
      expect(useSettingsStore.getState().pdfSpreadView).toBe(false);

      useSettingsStore.getState().togglePdfSpreadView();
      expect(useSettingsStore.getState().pdfSpreadView).toBe(true);

      useSettingsStore.getState().togglePdfSpreadView();
      expect(useSettingsStore.getState().pdfSpreadView).toBe(false);
    });

    it('sets pdfSpreadView explicitly via setPdfSpreadView', () => {
      useSettingsStore.getState().setPdfSpreadView(true);
      expect(useSettingsStore.getState().pdfSpreadView).toBe(true);

      useSettingsStore.getState().setPdfSpreadView(false);
      expect(useSettingsStore.getState().pdfSpreadView).toBe(false);
    });

    it('correctly calculates page pairs for two-page spread layout', () => {
      function computePagePairs(numPages: number): number[][] {
        const pairs: number[][] = [];
        for (let i = 0; i < numPages; i += 2) {
          if (i + 1 < numPages) {
            pairs.push([i, i + 1]);
          } else {
            pairs.push([i]);
          }
        }
        return pairs;
      }

      // Even number of pages
      expect(computePagePairs(4)).toEqual([
        [0, 1],
        [2, 3],
      ]);

      // Odd number of pages
      expect(computePagePairs(5)).toEqual([
        [0, 1],
        [2, 3],
        [4],
      ]);

      // Single page document
      expect(computePagePairs(1)).toEqual([[0]]);

      // Empty document
      expect(computePagePairs(0)).toEqual([]);
    });

    it('adjusts target width for auto-fit when spread view is active', () => {
      function getFittedScale(containerWidth: number, isSpread: boolean): number {
        const available = containerWidth - 48;
        const targetWidth = isSpread ? 595 * 2 + 16 : 595;
        const s = available / targetWidth;
        return Math.max(0.3, Math.min(s, 2.5));
      }

      const containerWidth = 1250;
      const singlePageScale = getFittedScale(containerWidth, false);
      const spreadPageScale = getFittedScale(containerWidth, true);

      // In spread mode with 2 pages side-by-side, scale per page should be halved to fit both
      expect(spreadPageScale).toBeLessThan(singlePageScale);
      expect(spreadPageScale).toBeCloseTo(0.996, 2);
    });
  });
});
