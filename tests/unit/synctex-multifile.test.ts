import { describe, it, expect } from 'vitest';
import {
  parseSyncTeX,
  resolveForwardDetail,
  resolveReverse,
  resolvePageForLine,
} from '@/features/editor/domain/document/synctex-index';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

describe('Bidirectional SyncTeX Multi-File & Subfile Precision (Overleaf Parity)', () => {
  // Realistic multi-file SyncTeX sample
  const sampleSyncTeX = `SyncTeX Version:1
Input:1:main.tex
Input:2:sections/intro.tex
Input:3:./chapters/results.tex
Output:main.pdf
Unit:65536
Magnification:1000
Offset:0,0
{1
[1,10:200,300:100,20
x1,15:200,350
]
}1
{2
[2,5:150,250:120,20
x2,12:150,320
]
}2
{3
[3,1:180,220:140,20
x3,8:180,280
]
}3
`;

  it('correctly parses and indexes multiple subfiles both with and without extensions', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    expect(map.pathToTag.get('main.tex')).toBe(1);
    expect(map.pathToTag.get('main')).toBe(1);

    expect(map.pathToTag.get('sections/intro.tex')).toBe(2);
    expect(map.pathToTag.get('sections/intro')).toBe(2);
    expect(map.pathToTag.get('intro.tex')).toBe(2);
    expect(map.pathToTag.get('intro')).toBe(2);

    expect(map.pathToTag.get('chapters/results.tex')).toBe(3);
    expect(map.pathToTag.get('chapters/results')).toBe(3);
    expect(map.pathToTag.get('results.tex')).toBe(3);
  });

  it('resolves forward sync to exact subfile page and coordinates', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    // Forward sync from sections/intro.tex line 5 -> should jump to Page 2
    const forwardIntro = resolveForwardDetail(5, map, 'sections/intro.tex');
    expect(forwardIntro).not.toBeNull();
    expect(forwardIntro?.page).toBe(2);

    // Forward sync from extensionless activeTitle "sections/intro" -> should jump to Page 2
    const forwardIntroNoExt = resolveForwardDetail(5, map, 'sections/intro');
    expect(forwardIntroNoExt?.page).toBe(2);

    // Forward sync from chapters/results.tex line 1 -> should jump to Page 3
    const forwardResults = resolveForwardDetail(1, map, 'chapters/results.tex');
    expect(forwardResults?.page).toBe(3);

    // Forward sync from main.tex line 10 -> should jump to Page 1
    const forwardMain = resolveForwardDetail(10, map, 'main.tex');
    expect(forwardMain?.page).toBe(1);
  });

  it('prevents subfile lines from leaking into root main.tex page mapping', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    // Line 999 in Tag 2 does not exist in Tag 2. It must NOT return Page 1.
    const result = resolvePageForLine(map, 999, 2);
    expect(result).toBeNull();
  });

  it('resolves reverse sync (double-click in PDF) to correct subfile path and line', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    // Page 2 node: y ~ 249, line=5, tag=2 (sections/intro.tex)
    const reversePage2 = resolveReverse(0.3, 2, map, 150, 249);
    expect(reversePage2).not.toBeNull();
    expect(reversePage2?.sourcePath).toBe('sections/intro.tex');
    expect(reversePage2?.line).toBe(5);

    // Page 3 node: y ~ 219, line=1, tag=3 (./chapters/results.tex)
    const reversePage3 = resolveReverse(0.2, 3, map, 180, 219);
    expect(reversePage3).not.toBeNull();
    expect(reversePage3?.sourcePath).toBe('./chapters/results.tex');
    expect(reversePage3?.line).toBe(1);
  });

  it('lruDocumentCache.findByPath matches Windows backslashes and Docker container paths', () => {
    lruDocumentCache.clearAll();
    lruDocumentCache.registerModel('file-intro-123', {
      content: '\\section{Introduction}',
      filePath: 'sections/intro.tex',
    });

    // Match exact relative path
    expect(lruDocumentCache.findByPath('sections/intro.tex')?.fileId).toBe('file-intro-123');

    // Match Windows backslashes
    expect(lruDocumentCache.findByPath('sections\\intro.tex')?.fileId).toBe('file-intro-123');

    // Match Docker/Server container absolute path
    expect(lruDocumentCache.findByPath('/tmp/compile_xyz/sections/intro.tex')?.fileId).toBe('file-intro-123');

    // Match extensionless input path
    expect(lruDocumentCache.findByPath('sections/intro')?.fileId).toBe('file-intro-123');

    // Match bare filename
    expect(lruDocumentCache.findByPath('intro.tex')?.fileId).toBe('file-intro-123');
  });
});
