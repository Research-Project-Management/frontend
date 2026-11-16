import { describe, it, expect } from 'vitest';
import type { SyncTeXMap } from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { extractDoiFromText, parsePdfDate } from '@/features/editor/subsystems/compiler/synctex/pdf-resolver';
import { CompilePipeline } from '@/features/editor/subsystems/compiler';
import { parseCompileErrors } from '@/features/editor/domain/latex/latex-structure';
import type { CompilerDiagnostic } from '@/features/editor/domain/types/compiler.types';

function createSeededSyncTeXMap(): SyncTeXMap {
  return {
    lineToPage: new Map<number, number>([
      [10, 1],
      [15, 1],
      [20, 1],
    ]),
    tagLineToPage: new Map<string, number>([
      ['1:10', 1],
      ['1:15', 1],
      ['2:5', 2],
      ['2:12', 2],
    ]),
    pageToLines: new Map<number, number[]>([
      [1, [10, 15, 20]],
      [2, [5, 12]],
    ]),
    sortedLines: [5, 10, 12, 15, 20],
    pageToNodes: new Map(),
    tagLineToNode: new Map([
      ['1:10', { line: 10, tag: 1, x: 100, y: 200, page: 1 }],
      ['2:5', { line: 5, tag: 2, x: 100, y: 200, page: 2 }],
    ]),
    tagToPath: new Map<number, string>([
      [1, 'main.tex'],
      [2, 'chapters/intro.tex'],
    ]),
    pathToTag: new Map<string, number>([
      ['main.tex', 1],
      ['chapters/intro.tex', 2],
      ['intro.tex', 2],
    ]),
    tagToSortedLines: new Map([
      [1, [10, 15, 20]],
      [2, [5, 12]],
    ]),
  };
}

describe('Document & LaTeX Compiler Frontend Utilities', () => {
  describe('CompilePipeline.resolveForward', () => {
    it('should map editor line to correct PDF page with seeded SyncTeXMap', () => {
      const synctexMap = createSeededSyncTeXMap();

      const targetPageMain = CompilePipeline.resolveForward(
        10,
        synctexMap,
        'main.tex',
        2,
      );
      expect(targetPageMain).toBe(1);

      const targetPageChild = CompilePipeline.resolveForward(
        5,
        synctexMap,
        'chapters/intro.tex',
        2,
      );
      expect(targetPageChild).toBe(2);
    });

    it('should return null when line is not in map', () => {
      const synctexMap = createSeededSyncTeXMap();
      const targetPage = CompilePipeline.resolveForward(
        9999,
        synctexMap,
        'main.tex',
        2,
      );
      expect(targetPage).toBeNull();
    });
  });

  describe('CompilePipeline.resolveReverse', () => {
    it('should resolve click position on page to source line', () => {
      const synctexMap = createSeededSyncTeXMap();

      const resolved = CompilePipeline.resolveReverse(0.5, 1, synctexMap);
      expect(resolved).not.toBeNull();
      expect(resolved?.line).toBe(10);
    });

    it('should return null when page is missing or map is null', () => {
      const synctexMap = createSeededSyncTeXMap();
      expect(CompilePipeline.resolveReverse(0.5, 99, synctexMap)).toBeNull();
      expect(CompilePipeline.resolveReverse(0.5, 1, null)).toBeNull();
    });
  });

  describe('parseCompileErrors', () => {
    it('should map structured backend diagnostics without requiring raw log parsing', () => {
      const structuredDiagnostics: CompilerDiagnostic[] = [
        {
          file: 'main.tex',
          line: 42,
          message: 'Environment unknownenv undefined.',
          context: '\\begin{unknownenv}',
          severity: 'error',
          code: 'ENV_UNDEFINED',
          quickFix: {
            description: 'Add \\usepackage{unknownenv}',
            replacementText: '\\usepackage{unknownenv}',
          },
        },
        {
          file: 'chapters/intro.tex',
          line: 12,
          message: 'Citation `knuth1984` undefined',
          severity: 'warning',
        },
      ];

      const errors = parseCompileErrors('', structuredDiagnostics);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        file: 'main.tex',
        line: 42,
        message: 'Environment unknownenv undefined.',
        severity: 'error',
        code: 'ENV_UNDEFINED',
        suggestion: 'Add \\usepackage{unknownenv}',
      });
      expect(errors[1]).toMatchObject({
        file: 'chapters/intro.tex',
        line: 12,
        severity: 'warning',
      });
    });

    it('should return empty array when both log and diagnostics are empty', () => {
      expect(parseCompileErrors('')).toEqual([]);
    });
  });

  describe('extractDoiFromText and parsePdfDate', () => {
    it('should extract standard DOI from mixed text', () => {
      const text = 'Published in Nature 2024. DOI: 10.1038/s41586-024-00000-0. Available online.';
      const doi = extractDoiFromText(text);
      expect(doi).toBe('10.1038/s41586-024-00000-0');
    });

    it('should clean trailing punctuation from extracted DOI', () => {
      const text = 'See 10.1145/3318464.3389700, and follow up.';
      const doi = extractDoiFromText(text);
      expect(doi).toBe('10.1145/3318464.3389700');
    });

    it('should format PDF creation date to ISO YYYY-MM-DD', () => {
      expect(parsePdfDate('D:20240515143000Z')).toBe('2024-05-15');
      expect(parsePdfDate(undefined)).toBeUndefined();
    });
  });
});
