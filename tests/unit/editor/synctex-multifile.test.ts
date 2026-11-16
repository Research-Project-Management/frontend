import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveForwardDetail,
  resolveReverse,
  resolvePageForLine,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

function buildMultiFileSyncTeXMap(): SyncTeXMap {
  return {
    lineToPage: new Map<number, number>([
      [10, 1],
      [5, 2],
      [1, 3],
    ]),
    tagLineToPage: new Map<string, number>([
      ['1:10', 1],
      ['1:15', 1],
      ['2:5', 2],
      ['2:12', 2],
      ['3:1', 3],
      ['3:10', 4],
    ]),
    pageToLines: new Map<number, number[]>([
      [1, [10, 15]],
      [2, [5, 12]],
      [3, [1, 8]],
    ]),
    sortedLines: [1, 5, 10, 12, 15],
    pageToNodes: new Map(),
    tagLineToNode: new Map([
      ['1:10', { line: 10, tag: 1, x: 200, y: 300, w: 100, h: 20, page: 1 }],
      ['2:5', { line: 5, tag: 2, x: 150, y: 250, w: 120, h: 20, page: 2 }],
      ['3:1', { line: 1, tag: 3, x: 180, y: 220, w: 140, h: 20, page: 3 }],
    ]),
    tagToPath: new Map<number, string>([
      [1, 'main.tex'],
      [2, 'sections/intro.tex'],
      [3, './chapters/results.tex'],
    ]),
    pathToTag: new Map<string, number>([
      ['main.tex', 1],
      ['main', 1],
      ['sections/intro.tex', 2],
      ['sections/intro', 2],
      ['chapters/results.tex', 3],
      ['chapters/results', 3],
    ]),
    tagToSortedLines: new Map([
      [1, [10, 15]],
      [2, [5, 12]],
      [3, [1, 8]],
    ]),
  };
}

describe('Bidirectional SyncTeX Multi-File & Subfile Precision (Overleaf Parity)', () => {
  beforeEach(() => {
    lruDocumentCache.clearAll();
  });

  it('resolves forward sync with filePath via tagLineToNode and tagLineToPage', () => {
    const map = buildMultiFileSyncTeXMap();

    // Exact subfile node match
    const forwardIntro = resolveForwardDetail(5, map, 'sections/intro.tex');
    expect(forwardIntro).toEqual({ page: 2, x: 150, y: 250, w: 120, h: 20 });

    // Extensionless subfile path match via tagLineToPage
    const forwardIntroNoExt = resolveForwardDetail(12, map, 'sections/intro');
    expect(forwardIntroNoExt).toEqual({ page: 2 });

    // Leading ./, /, and Windows backslash normalization
    expect(resolveForwardDetail(1, map, './chapters/results.tex')?.page).toBe(3);
    expect(resolveForwardDetail(1, map, '/./chapters/results.tex')?.page).toBe(3);
    expect(resolveForwardDetail(1, map, 'chapters\\results.tex')?.page).toBe(3);

    // Same line number in different subfile resolves to tag-specific page (line 10 in tag 3 -> page 4, not tag 1 -> page 1)
    expect(resolveForwardDetail(10, map, 'chapters/results.tex')?.page).toBe(4);
    expect(resolveForwardDetail(10, map, 'main.tex')?.page).toBe(1);
  });

  it('prevents unknown subfile lines from leaking into root page mapping', () => {
    const map = buildMultiFileSyncTeXMap();

    expect(resolvePageForLine(map, 999, 2)).toBeNull();
    expect(resolvePageForLine(map, 10, 3)).toBe(4);
    expect(resolvePageForLine(map, 10, 1)).toBe(1);
    expect(resolveForwardDetail(999, map, 'sections/intro.tex')).toBeNull();
  });

  it('resolves reverse sync from pageToLines on a seeded SyncTeXMap', () => {
    const map = buildMultiFileSyncTeXMap();

    expect(resolveReverse(0.3, 2, map, 150, 249)).toEqual({
      line: 5,
      sourcePath: null,
    });
    expect(resolveReverse(0.2, 3, map, 180, 219)).toEqual({
      line: 1,
      sourcePath: null,
    });
    expect(resolveReverse(0.5, 99, map)).toBeNull();
    expect(resolveReverse(0.5, 1, null)).toBeNull();
  });

  it('lruDocumentCache.findByPath matches Windows backslashes and Docker container paths', () => {
    lruDocumentCache.registerModel('file-intro-123', {
      content: '\\section{Introduction}',
      filePath: 'sections/intro.tex',
    });

    expect(lruDocumentCache.findByPath('sections/intro.tex')?.fileId).toBe('file-intro-123');
    expect(lruDocumentCache.findByPath('sections\\intro.tex')?.fileId).toBe('file-intro-123');
    expect(lruDocumentCache.findByPath('/tmp/compile_xyz/sections/intro.tex')?.fileId).toBe(
      'file-intro-123',
    );
    expect(lruDocumentCache.findByPath('sections/intro')?.fileId).toBe('file-intro-123');
    expect(lruDocumentCache.findByPath('intro.tex')?.fileId).toBe('file-intro-123');
  });
});
