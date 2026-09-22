import { describe, it, expect } from 'vitest';
import {
  parseSyncTeX,
  resolvePageForLine,
} from '../../src/features/editor/domain/synctex/synctex-resolver';

describe('Domain: SyncTeX Resolver', () => {
  const sampleSyncTeX = `SyncTeX Version:1
Input:1:/workspace/main.tex
Input:2:/workspace/chapters/intro.tex
{1
[1,10:1000000,2000000:500000,600000:0
(1,25:1500000,2500000:300000,400000:0
)
]
}1
{2
[2,5:1200000,2200000:400000,500000:0
(2,15:1800000,2800000:350000,450000:0
)
]
}2`;

  it('parses raw synctex inputs and assigns tag mappings', () => {
    const map = parseSyncTeX(sampleSyncTeX);
    expect(map.tagToPath.get(1)).toBe('/workspace/main.tex');
    expect(map.tagToPath.get(2)).toBe('/workspace/chapters/intro.tex');
    expect(map.pathToTag.get('main.tex')).toBe(1);
    expect(map.pathToTag.get('intro.tex')).toBe(2);
  });

  it('resolves page for line accurately with direct match and tag match', () => {
    const map = parseSyncTeX(sampleSyncTeX);
    // Line 10 with fileTag 1 should map to page 1
    const p1 = resolvePageForLine(map, 10, 1);
    expect(p1).toBe(1);

    // Line 5 with fileTag 2 should map to page 2
    const p2 = resolvePageForLine(map, 5, 2);
    expect(p2).toBe(2);
  });

  it('falls back to binary search for nearest preceding line', () => {
    const map = parseSyncTeX(sampleSyncTeX);
    // Line 12 (between 10 and 25) in page 1 should resolve to 1
    const p = resolvePageForLine(map, 12);
    expect(p).toBe(1);
  });

  it('returns null safely when input map is empty', () => {
    const emptyMap = parseSyncTeX('');
    expect(resolvePageForLine(emptyMap, 999)).toBeNull();
  });
});
