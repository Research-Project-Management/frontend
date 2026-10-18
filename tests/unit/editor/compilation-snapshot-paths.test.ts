import { describe, it, expect } from 'vitest';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import { computeDraftDiffSummary } from '@/features/editor/domain/document/draft-diff';

describe('#7 compilation snapshot path resolution', () => {
  const chapterId = '3f2a9c1e-uuid-chapter';

  it('resolves LRU models without filePath to their page-store title, not the UUID', () => {
    const snap = assembleCompilationSnapshot({
      baseFiles: [{ id: chapterId, title: 'chapters/intro.tex', content: 'stale server' }],
      lruModels: [{ fileId: chapterId, filePath: chapterId, content: 'fresh buffer', isDirty: true }],
    });
    expect(snap.files['chapters/intro.tex']).toBe('fresh buffer');
    expect(snap.files[chapterId]).toBe('fresh buffer');
    expect(Object.keys(snap.files)).not.toContain(`${chapterId}.tex`);
  });

  it('writes dirty buffers under the resolved path too', () => {
    const snap = assembleCompilationSnapshot({
      baseFiles: [{ id: chapterId, title: 'chapters/intro.tex', content: 'stale' }],
      dirtyFiles: [{ fileId: chapterId, content: 'dirty newest' }],
    });
    expect(snap.files['chapters/intro.tex']).toBe('dirty newest');
  });

  it('uses explicit filePathsById when provided', () => {
    const snap = assembleCompilationSnapshot({
      lruModels: [{ fileId: chapterId, content: 'x' }],
      filePathsById: { [chapterId]: 'refs.bib' },
    });
    expect(snap.files['refs.bib']).toBe('x');
  });
});

describe('draft diff summary', () => {
  it('reports identical content', () => {
    expect(computeDraftDiffSummary('a\nb', 'a\nb').identical).toBe(true);
  });
  it('counts added and removed lines with preview', () => {
    const s = computeDraftDiffSummary('a\nB\nc\nd', 'a\nb\nc');
    expect(s.identical).toBe(false);
    expect(s.addedLines).toBe(2);
    expect(s.removedLines).toBe(1);
    expect(s.preview.map((p) => `${p.type}:${p.text}`)).toEqual(
      expect.arrayContaining(['added:B', 'added:d', 'removed:b'])
    );
  });
});

import { buildPageStoreFilePaths } from '@/features/editor/subsystems/compiler';

describe('#7 snapshot coordinator page-store path map', () => {
  it('collects titles from file hierarchy (nested), current page and active file', () => {
    const map = buildPageStoreFilePaths({
      currentPage: { id: 'root', title: 'main.tex' },
      activeFilePage: { id: 'f1', title: 'intro.tex', path: 'chapters/intro.tex' },
      fileHierarchy: [
        { id: 'root', title: 'main.tex', children: [{ id: 'c2', title: 'refs.bib' } as any] } as any,
      ],
    });
    expect(map).toEqual({ root: 'main.tex', f1: 'chapters/intro.tex', c2: 'refs.bib' });
  });
});
