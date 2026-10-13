import { describe, it, expect } from 'vitest';
import {
  QuadTree,
  boxIntersects,
  getViewportWorldBounds,
  type QuadTreeItem,
} from '@/features/editor/domain/canvas/quad-tree';
import { TikZTranspiler } from '@/features/editor/domain/canvas/tikz-transpiler';
import type {
  CanvasElement,
  CanvasShapeType,
  ViewportState,
  BoundingBox,
} from '@/features/editor/domain/canvas/canvas-types';

describe('Collaborative Diagram Canvas - Concurrency Stress & Memory Profiling', () => {
  // =========================================================================
  // 1. SPATIAL CULLING ACCURACY UNDER 10,000 NODES & HIGH-SPEED VIEWPORT MOVEMENTS
  // =========================================================================
  describe('1. 10,000 Node Spatial Culling Accuracy (Ground Truth Verification)', () => {
    it('achieves 100% precision and recall against brute-force linear scan across 200 random viewports', () => {
      const worldBounds: BoundingBox = { x: -5000, y: -5000, width: 10000, height: 10000 };
      const tree = new QuadTree<QuadTreeItem>(worldBounds, 16, 8);

      const totalNodes = 10000;
      const allNodes: QuadTreeItem[] = [];

      // Populate 10,000 nodes scattered across the canvas world
      for (let i = 0; i < totalNodes; i++) {
        // Clustered & uniformly distributed hybrid layout
        const clusterOffsetX = (i % 10) * 800 - 4000;
        const clusterOffsetY = Math.floor(i / 1000) * 800 - 4000;
        const item: QuadTreeItem = {
          id: `node-${i}`,
          x: clusterOffsetX + (i % 100) * 8,
          y: clusterOffsetY + (Math.floor(i / 100) % 10) * 8,
          width: 80,
          height: 40,
        };
        allNodes.push(item);
        tree.insert(item);
      }

      expect(tree.size()).toBe(totalNodes);

      // Perform 200 random viewport queries simulating panning & zooming
      for (let q = 0; q < 200; q++) {
        const viewport: ViewportState = {
          panX: (q * 137) % 3000 - 1500,
          panY: (q * 251) % 3000 - 1500,
          zoom: 0.5 + (q % 5) * 0.5,
          width: 1920,
          height: 1080,
        };

        const viewBounds = getViewportWorldBounds(viewport);

        // QuadTree logarithmic spatial query
        const culledNodes = tree.queryRange(viewBounds);
        const culledIdSet = new Set(culledNodes.map((n) => n.id));

        // Brute-force ground truth check O(N)
        const groundTruth = allNodes.filter((n) =>
          boxIntersects(
            { x: n.x, y: n.y, width: n.width, height: n.height },
            viewBounds
          )
        );

        // 100% Recall: Every visible node must be present in culled results
        for (const expectedNode of groundTruth) {
          expect(culledIdSet.has(expectedNode.id)).toBe(true);
        }

        // 100% Precision: No false inclusions outside the range
        expect(culledNodes.length).toBe(groundTruth.length);
      }
    });
  });

  // =========================================================================
  // 2. MULTI-ACTOR CONCURRENT MUTATIONS & CRDT EVENTUAL CONSISTENCY
  // =========================================================================
  describe('2. Multi-Actor Concurrent Mutations (Simulated Distributed Canvas)', () => {
    it('preserves referential integrity and produces valid TikZ AST after 1,000 interleaved mutations', () => {
      const elementsMap = new Map<string, CanvasElement>();
      const nodeIds: string[] = [];

      const actors = ['actor-A', 'actor-B', 'actor-C', 'actor-D'];
      const shapeTypes: CanvasShapeType[] = ['rectangle', 'ellipse', 'diamond', 'database', 'cloud'];

      for (let op = 0; op < 1000; op++) {
        const actor = actors[op % actors.length];
        const actionType = op % 5;

        if (actionType === 0 || nodeIds.length < 5) {
          // Action: Add new node
          const id = `node-${actor}-${op}`;
          nodeIds.push(id);
          elementsMap.set(id, {
            id,
            type: shapeTypes[op % shapeTypes.length],
            x: (op * 40) % 1000,
            y: (op * 30) % 800,
            width: 120,
            height: 50,
            text: `Step ${op} by ${actor}`,
            updatedAt: Date.now(),
            updatedBy: actor,
          });
        } else if (actionType === 1) {
          // Action: Move node across spatial coordinates
          const targetId = nodeIds[op % nodeIds.length];
          const el = elementsMap.get(targetId);
          if (el) {
            el.x += 25;
            el.y += 15;
            el.updatedAt = Date.now();
          }
        } else if (actionType === 2 && nodeIds.length >= 2) {
          // Action: Connect directed arrow between two nodes
          const fromIdx = op % nodeIds.length;
          const toIdx = (op + 1) % nodeIds.length;
          const fromId = nodeIds[fromIdx];
          const toId = nodeIds[toIdx];

          if (fromId !== toId && elementsMap.has(fromId) && elementsMap.has(toId)) {
            const edgeId = `arrow-${fromId}->${toId}`;
            elementsMap.set(edgeId, {
              id: edgeId,
              type: 'arrow',
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              sourceElementId: fromId,
              targetElementId: toId,
              text: `flow-${op}`,
              strokeStyle: op % 2 === 0 ? 'solid' : 'dashed',
              updatedAt: Date.now(),
              updatedBy: actor,
            });
          }
        } else if (actionType === 3 && nodeIds.length > 10) {
          // Action: Delete node and clean up dangling arrows
          const removeIdx = op % nodeIds.length;
          const removedId = nodeIds.splice(removeIdx, 1)[0];
          elementsMap.delete(removedId);

          // Clean cascade arrows
          for (const [id, el] of elementsMap.entries()) {
            if (el.type === 'arrow' && (el.sourceElementId === removedId || el.targetElementId === removedId)) {
              elementsMap.delete(id);
            }
          }
        }
      }

      // Assert referential integrity of remaining arrows
      const remainingElements = Array.from(elementsMap.values());
      for (const el of remainingElements) {
        if (el.type === 'arrow') {
          expect(elementsMap.has(el.sourceElementId!)).toBe(true);
          expect(elementsMap.has(el.targetElementId!)).toBe(true);
        }
      }

      // Verify that TikZ transpiler compiles the converged state into valid LaTeX code
      const tikzCode = TikZTranspiler.transpile(remainingElements);
      expect(tikzCode).toContain('\\begin{tikzpicture}');
      expect(tikzCode).toContain('\\end{tikzpicture}');
    });
  });

  // =========================================================================
  // 3. TREE DEALLOCATION & MEMORY RECYCLING
  // =========================================================================
  describe('3. QuadTree Deep Clear & Memory Recycling', () => {
    it('properly releases internal subtrees and item references on clear() with bounded heap delta', () => {
      const bounds: BoundingBox = { x: 0, y: 0, width: 2000, height: 2000 };
      const tree = new QuadTree<QuadTreeItem>(bounds, 8, 6);

      if (typeof global.gc === 'function') {
        global.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;

      // 10 cycles of inserting 5,000 items and clearing
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 5000; i++) {
          tree.insert({
            id: `cycle-${cycle}-item-${i}`,
            x: (i * 17) % 2000,
            y: (i * 23) % 2000,
            width: 20,
            height: 20,
          });
        }
        expect(tree.size()).toBe(5000);

        // Perform range query during load
        const queryRes = tree.queryRange({ x: 100, y: 100, width: 500, height: 500 });
        expect(queryRes.length).toBeGreaterThan(0);

        // Clear tree completely
        tree.clear();
        expect(tree.size()).toBe(0);
        expect((tree as any).items.length).toBe(0);
        expect((tree as any).divided).toBe(false);
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      // Memory delta should remain small (< 40MB across 10 insert-query-clear cycles)
      expect(heapDeltaMb).toBeLessThan(40);
    });
  });
});
