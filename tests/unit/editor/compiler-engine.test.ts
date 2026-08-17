import { describe, it, expect } from 'vitest';
import { LatexCompilerEngine, parseSyncTeX } from '@/features/editor/utils/viewer.util';

describe('LatexCompilerEngine & SyncTeX Deep Module', () => {
  const sampleSyncTeX = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./chapters/intro.tex
{1
[1:100,0:200,0
x1:10,0:200,27590656
g1:15,0:200,27590656
]
}
{2
[2:100,0:200,0
x2:5,0:200,27590656
g2:10,0:200,27590656
]
}`;

  it('parses SyncTeX map with tag and coordinate mappings correctly', () => {
    const map = parseSyncTeX(sampleSyncTeX);
    expect(map).toBeDefined();
    expect(map.tagToPath.get(1)).toBe('./main.tex');
    expect(map.tagToPath.get(2)).toBe('./chapters/intro.tex');
    expect(map.pathToTag.get('main.tex')).toBe(1);
    expect(map.pathToTag.get('intro.tex')).toBe(2);
  });

  it('resolves forward sync from editor line to PDF page', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    // Line 15 in main.tex -> page 1
    const page1 = LatexCompilerEngine.resolveForward(15, map, 'main.tex', 2);
    expect(page1).toBe(1);

    // Line 10 in intro.tex -> page 2
    const page2 = LatexCompilerEngine.resolveForward(10, map, 'intro.tex', 2);
    expect(page2).toBe(2);

    // Unknown line returns null
    const unknown = LatexCompilerEngine.resolveForward(999, map, 'unknown.tex', 2);
    expect(unknown).toBeNull();
  });

  it('handles deeply nested sub-paths and Windows backslashes in forward sync', () => {
    const nestedSyncTeX = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./chapters/sub/analysis.tex
{1
[1:100,0:200,0
x1:1,0:200,0
]
}
{2
[2:100,0:200,0
x2:42,0:200,0
]
}`;
    const map = parseSyncTeX(nestedSyncTeX);
    expect(map).toBeDefined();

    // Testing forward resolution with Windows backslashes
    const page = LatexCompilerEngine.resolveForward(42, map, 'chapters\\sub\\analysis.tex', 2);
    expect(page).toBe(2);

    // Testing forward resolution with just the basename
    const pageFromBase = LatexCompilerEngine.resolveForward(42, map, 'analysis.tex', 2);
    expect(pageFromBase).toBe(2);
  });

  it('clamps out-of-bounds click fractions defensively in reverse sync', () => {
    const map = parseSyncTeX(sampleSyncTeX);

    // Negative fraction
    const resNegative = LatexCompilerEngine.resolveReverse(-0.8, 1, map);
    expect(resNegative).toBeDefined();
    expect(resNegative?.sourcePath).toBe('./main.tex');

    // Overflow fraction (> 1.0)
    const resOverflow = LatexCompilerEngine.resolveReverse(2.5, 1, map);
    expect(resOverflow).toBeDefined();
    expect(resOverflow?.sourcePath).toBe('./main.tex');
  });
});

