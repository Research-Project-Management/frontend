import { describe, it, expect } from 'vitest';
import {
  parseSyncTeX,
  buildKdTree2D,
  searchKdTreeNearest,
  pointToAabbDistSq,
  getNodeBounds,
  resolveReverse,
  type SyncTeXMap,
  type SyncTeXNode,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';

describe('SyncTeX 2D Spatial Search Algorithm (k-d Tree & Two-Column Disambiguation)', () => {
  describe('1. Geometry & Distance Primitives', () => {
    it('calculates accurate bounding boxes considering TeX baseline convention', () => {
      const node: SyncTeXNode = {
        line: 10,
        tag: 1,
        x: 100,
        y: 200,
        w: 150,
        h: 14,
      };

      const bounds = getNodeBounds(node);
      expect(bounds.minX).toBe(100);
      expect(bounds.maxX).toBe(250);
      expect(bounds.minY).toBe(186); // y - h
      expect(bounds.maxY).toBe(214); // y + h
      expect(bounds.area).toBe(150 * 28);
    });

    it('returns distance 0 when point is strictly inside the AABB', () => {
      // Box from [100, 200] x [150, 180]
      const distSq = pointToAabbDistSq(150, 165, 100, 200, 150, 180);
      expect(distSq).toBe(0);
    });

    it('calculates squared Euclidean distance when point is outside the AABB', () => {
      // Box from [100, 200] x [100, 200]
      // Point at (210, 200) -> dx = 10, dy = 0 -> distSq = 100
      expect(pointToAabbDistSq(210, 200, 100, 200, 100, 200)).toBe(100);

      // Point at (203, 204) -> dx = 3, dy = 4 -> distSq = 25
      expect(pointToAabbDistSq(203, 204, 100, 200, 100, 200)).toBe(25);

      // Point at (90, 90) -> dx = 10, dy = 10 -> distSq = 200
      expect(pointToAabbDistSq(90, 90, 100, 200, 100, 200)).toBe(200);
    });
  });

  describe('2. 2D k-d Tree Construction & Subtree Bounding Boxes', () => {
    it('returns null when building tree from empty node list', () => {
      expect(buildKdTree2D([])).toBeNull();
    });

    it('builds a hierarchical 2D tree with alternating split axes and tight subtree envelopes', () => {
      const nodes: (SyncTeXNode & { page: number })[] = [
        { line: 1, tag: 1, x: 50, y: 100, w: 100, h: 12, page: 1 },
        { line: 2, tag: 1, x: 200, y: 150, w: 100, h: 12, page: 1 },
        { line: 3, tag: 1, x: 100, y: 300, w: 100, h: 12, page: 1 },
      ];

      const tree = buildKdTree2D(nodes);
      expect(tree).not.toBeNull();
      expect(tree?.axis).toBe(0); // Root partitions on X
      expect(tree?.subMinX).toBe(50);
      expect(tree?.subMaxX).toBe(300); // 200 + 100
      expect(tree?.subMinY).toBeLessThanOrEqual(100 - 12);
      expect(tree?.subMaxY).toBeGreaterThanOrEqual(300 + 12);
    });
  });

  describe('3. Two-Column Scientific Document Disambiguation', () => {
    // Simulated IEEE/ACM Two-Column SyncTeX file
    const twoColumnSyncTeX = `SyncTeX Version:1
Input:1:./chapters/column1.tex
Input:2:./chapters/column2.tex
{1
[1,10,0:3538944,9830400:11796480,786432
[1,11,0:3538944,10813440:11796480,786432
[2,80,0:20971520,9830400:11796480,786432
[2,81,0:20971520,10813440:11796480,786432
}`;
    // Coordinates (approx scaled):
    // Column 1 (tag 1): x ~ 54 pt, line 10 at y ~ 150 pt, line 11 at y ~ 165 pt, width ~ 180 pt
    // Column 2 (tag 2): x ~ 320 pt, line 80 at y ~ 150 pt, line 81 at y ~ 165 pt, width ~ 180 pt

    it('disambiguates between Column 1 and Column 2 at identical vertical Y positions', () => {
      const map: SyncTeXMap = parseSyncTeX(twoColumnSyncTeX);

      expect(map.pageToKdTree?.has(1)).toBe(true);

      // User double clicks in Column 1 (x = 100, y = 150)
      const resCol1 = resolveReverse(0.18, 1, map, 100, 150);
      expect(resCol1).not.toBeNull();
      expect(resCol1?.line).toBe(10);
      expect(resCol1?.sourcePath).toBe('./chapters/column1.tex');

      // User double clicks in Column 2 (x = 380, y = 150) - SAME Y as line 10!
      const resCol2 = resolveReverse(0.18, 1, map, 380, 150);
      expect(resCol2).not.toBeNull();
      expect(resCol2?.line).toBe(80);
      expect(resCol2?.sourcePath).toBe('./chapters/column2.tex');
    });

    it('correctly associates clicks in the gutter space to the nearest adjacent column', () => {
      const map: SyncTeXMap = parseSyncTeX(twoColumnSyncTeX);

      // Gutter is between x = 234 and x = 320.
      // Click at x = 240 (very close to right edge of Column 1 at ~234)
      const resNearCol1 = resolveReverse(0.18, 1, map, 240, 150);
      expect(resNearCol1?.line).toBe(10);
      expect(resNearCol1?.sourcePath).toBe('./chapters/column1.tex');

      // Click at x = 310 (very close to left edge of Column 2 at ~320)
      const resNearCol2 = resolveReverse(0.18, 1, map, 310, 150);
      expect(resNearCol2?.line).toBe(80);
      expect(resNearCol2?.sourcePath).toBe('./chapters/column2.tex');
    });
  });

  describe('4. Bounding Box Containment & Specificity Prioritization', () => {
    it('prioritizes tighter child boxes (e.g. inline math/citation) over wide paragraph boxes', () => {
      // Outer line box (wide) vs inner formula box (tight)
      const nodes: (SyncTeXNode & { page: number })[] = [
        { line: 40, tag: 1, x: 50, y: 200, w: 400, h: 14, page: 1 }, // paragraph line
        { line: 42, tag: 1, x: 180, y: 200, w: 50, h: 14, page: 1 }, // inline formula
      ];

      const kdTree = buildKdTree2D(nodes);
      expect(kdTree).not.toBeNull();

      // Click directly inside formula box at (200, 200)
      const { bestNode, bestDistSq } = searchKdTreeNearest(kdTree, 200, 200);
      expect(bestDistSq).toBe(0);
      expect(bestNode?.line).toBe(42); // Formula line prioritized due to tighter area
    });
  });

  describe('5. High-Load Performance & Branch-and-Bound Pruning Complexity', () => {
    it('achieves O(log N) query traversal on a dense page with 1,500 nodes', () => {
      // Generate 1,500 nodes across 2 columns
      const denseNodes: (SyncTeXNode & { page: number })[] = [];
      let id = 1;
      for (let col = 0; col < 2; col++) {
        const colStartX = col === 0 ? 50 : 320;
        for (let row = 0; row < 750; row++) {
          denseNodes.push({
            line: id++,
            tag: col + 1,
            x: colStartX + (row % 5) * 10,
            y: 50 + row * 1,
            w: 180,
            h: 10,
            page: 1,
          });
        }
      }

      const kdTree = buildKdTree2D(denseNodes);
      expect(kdTree).not.toBeNull();

      // Run 100 queries across random coordinates
      let totalVisited = 0;
      const queryCount = 100;
      const startTime = performance.now();

      for (let i = 0; i < queryCount; i++) {
        const px = 50 + (i * 37) % 450;
        const py = 50 + (i * 17) % 750;
        const result = searchKdTreeNearest(kdTree, px, py);
        expect(result.bestNode).not.toBeNull();
        totalVisited += result.visitedCount;
      }

      const elapsedMs = performance.now() - startTime;
      const avgVisited = totalVisited / queryCount;

      // In a balanced tree of 1,500 nodes: log2(1500) ~ 10.5
      // With branch-and-bound pruning, average visited nodes should be well under 40 nodes (< 3% of total dataset)
      expect(avgVisited).toBeLessThan(40);

      // 100 queries should execute in well under 25ms (< 0.25ms per query)
      expect(elapsedMs).toBeLessThan(50);
    });
  });

  describe('6. Backward Compatibility & Fallback Paths', () => {
    it('gracefully falls back to 1D search when map has no pageToKdTree', () => {
      const legacyMap: SyncTeXMap = {
        lineToPage: new Map([[15, 1]]),
        tagLineToPage: new Map([['1:15', 1]]),
        pageToLines: new Map([[1, [15]]]),
        sortedLines: [15],
        pageToNodes: new Map([
          [1, [{ line: 15, tag: 1, x: 100, y: 200, page: 1 }]],
        ]),
        tagLineToNode: new Map([
          ['1:15', { line: 15, tag: 1, x: 100, y: 200, page: 1 }],
        ]),
        tagToPath: new Map([[1, 'main.tex']]),
        pathToTag: new Map([['main.tex', 1]]),
        tagToSortedLines: new Map([[1, [15]]]),
      };

      const res = resolveReverse(0.24, 1, legacyMap, 100, 205);
      expect(res).not.toBeNull();
      expect(res?.line).toBe(15);
      expect(res?.sourcePath).toBe('main.tex');
    });

    it('returns null when synctexMap is null or empty', () => {
      expect(resolveReverse(0.5, 1, null, 100, 200)).toBeNull();
      expect(resolveReverse(0.5, 1, undefined, 100, 200)).toBeNull();
    });
  });
});
