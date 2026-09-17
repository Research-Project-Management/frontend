import { describe, it, expect } from 'vitest';
import { detectMathAtPosition } from '@/features/editor/components/editor/math-hover.provider';
import { SHORTCUT_LIST } from '@/features/editor/components/modals/KeyboardShortcutsModal';
import { LatexCompilerEngine, parseSyncTeX } from '@/features/editor/utils/viewer.util';

describe('Advanced IDE Features (Overleaf Parity)', () => {
  describe('Math Hover Detection (detectMathAtPosition)', () => {
    it('should detect inline math and extract formula', () => {
      const line = 'In physics, $E = mc^2$ is the mass-energy equivalence.';
      // '$' is at index 12 (1-based col 13) to index 21 (1-based col 22)
      const matchInside = detectMathAtPosition(line, 16);
      expect(matchInside).not.toBeNull();
      expect(matchInside?.type).toBe('inline');
      expect(matchInside?.formula).toBe('E = mc^2');

      const matchOutside = detectMathAtPosition(line, 5);
      expect(matchOutside).toBeNull();
    });

    it('should detect display math $$...$$', () => {
      const line = '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$';
      const match = detectMathAtPosition(line, 10);
      expect(match).not.toBeNull();
      expect(match?.type).toBe('display');
      expect(match?.formula).toContain('\\int');
    });

    it('should detect bracket math \\[...\\]', () => {
      const line = '\\[ \\nabla \\cdot \\mathbf{B} = 0 \\]';
      const match = detectMathAtPosition(line, 8);
      expect(match).not.toBeNull();
      expect(match?.type).toBe('bracket');
      expect(match?.formula).toBe('\\nabla \\cdot \\mathbf{B} = 0');
    });

    it('should detect math environment lines', () => {
      const line = '  \\begin{equation}';
      const match = detectMathAtPosition(line, 5);
      expect(match).not.toBeNull();
      expect(match?.type).toBe('environment');
      expect(match?.formula).toBe('\\begin{equation}');
    });
  });

  describe('Keyboard Shortcuts Cheat Sheet (SHORTCUT_LIST)', () => {
    it('should contain all major categories', () => {
      const categories = new Set(SHORTCUT_LIST.map((s) => s.category));
      expect(categories).toContain('Compilation');
      expect(categories).toContain('Editing');
      expect(categories).toContain('Navigation');
      expect(categories).toContain('Layout');
    });

    it('should include core Overleaf keybindings', () => {
      const ids = SHORTCUT_LIST.map((s) => s.id);
      expect(ids).toContain('compile');
      expect(ids).toContain('shortcuts-help');
      expect(ids).toContain('quick-open');
      expect(ids).toContain('autocomplete');
      expect(ids).toContain('format-code');
      expect(ids).toContain('bold');
      expect(ids).toContain('italic');
    });
  });

  describe('SyncTeX Forward Coordinate Resolution (LatexCompilerEngine.resolveForwardDetail)', () => {
    it('should resolve page and coordinates from SyncTeX map', () => {
      const sampleSyncTex = [
        'SyncTeX Version:1',
        'Input:1:main.tex',
        '{1',
        '[1,1:100,200',
        '(1,5:150,300:10,20:0',
        'h1,12:2500000,4500000:50,10:0',
        '}1',
      ].join('\n');

      const map = parseSyncTeX(sampleSyncTex);
      expect(map.lineToPage.get(12)).toBe(1);

      const detail = LatexCompilerEngine.resolveForwardDetail(12, map, 'main.tex');
      expect(detail).not.toBeNull();
      expect(detail?.page).toBe(1);
      expect(detail?.x).toBe(2500000);
      expect(detail?.y).toBe(4500000);
    });

    it('should return null gracefully if line is not found or map is null', () => {
      expect(LatexCompilerEngine.resolveForwardDetail(999, null)).toBeNull();
    });
  });
});
