import { describe, it, expect } from 'vitest';
import {
  parseSyncTeX,
  LatexCompilerEngine,
  extractDoiFromText,
  parsePdfDate,
} from '@/features/editor/utils/viewer.util';
import { parseCompileErrors } from '@/features/editor/utils/editor.util';

describe('Document & LaTeX Compiler Frontend Utilities', () => {
  const sampleSyncTeX = `SyncTeX Version:1
Input:1:main.tex
Input:2:chapters/intro.tex
{1
[1:10,20:100000,200000
(1:15,25:120000,250000
h1:20,30:150000,300000
}
{2
[2:5,10:100000,200000
(2:12,18:130000,260000
}
`;

  describe('parseSyncTeX', () => {
    it('should parse SyncTeX inputs and coordinates accurately', () => {
      const synctexMap = parseSyncTeX(sampleSyncTeX);

      expect(synctexMap.tagToPath.get(1)).toBe('main.tex');
      expect(synctexMap.tagToPath.get(2)).toBe('chapters/intro.tex');
      expect(synctexMap.pathToTag.get('main.tex')).toBe(1);
      expect(synctexMap.pathToTag.get('intro.tex')).toBe(2);

      expect(synctexMap.lineToPage.get(10)).toBe(1);
      expect(synctexMap.lineToPage.get(15)).toBe(1);
      expect(synctexMap.tagLineToPage.get('2:5')).toBe(2);
    });
  });

  describe('LatexCompilerEngine.resolveForward', () => {
    it('should map editor line to correct PDF page', () => {
      const synctexMap = parseSyncTeX(sampleSyncTeX);

      const targetPageMain = LatexCompilerEngine.resolveForward(
        10,
        synctexMap,
        'main.tex',
        2,
      );
      expect(targetPageMain).toBe(1);

      const targetPageChild = LatexCompilerEngine.resolveForward(
        5,
        synctexMap,
        'intro.tex',
        2,
      );
      expect(targetPageChild).toBe(2);
    });

    it('should return null when line is not in map', () => {
      const synctexMap = parseSyncTeX(sampleSyncTeX);
      const targetPage = LatexCompilerEngine.resolveForward(
        9999,
        synctexMap,
        'main.tex',
        2,
      );
      expect(targetPage).toBeNull();
    });
  });

  describe('LatexCompilerEngine.resolveReverse', () => {
    it('should resolve click position on page to source line and path', () => {
      const synctexMap = parseSyncTeX(sampleSyncTeX);

      const resolved = LatexCompilerEngine.resolveReverse(0.5, 1, synctexMap);
      expect(resolved).not.toBeNull();
      expect(resolved?.sourcePath).toBe('main.tex');
      expect(resolved?.line).toBeGreaterThan(0);
    });
  });

  describe('parseCompileErrors', () => {
    it('should extract error line and message from standard LaTeX error log', () => {
      const sampleLog = `
This is pdfTeX, Version 3.141592653-2.6-1.40.24
! LaTeX Error: Environment unknownenv undefined.

See the LaTeX manual or LaTeX Companion for explanation.
Type  H <return>  for immediate help.
 ...

l.42 \\begin{unknownenv}

?
! Undefined control sequence.
l.55 \\invalidcmd
`;

      const errors = parseCompileErrors(sampleLog);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].message).toContain('Environment unknownenv undefined');
      expect(errors[0].line).toBe(42);
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
