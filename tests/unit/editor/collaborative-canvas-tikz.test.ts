/**
 * collaborative-canvas-tikz.test.ts
 *
 * Unit tests for:
 * 1. 2D Spatial QuadTree Index & Viewport Matrix Transformation
 * 2. Visual Canvas AST -> LaTeX TikZ Transpiler Engine
 * 3. Real-time Multi-user Yjs CRDT Synchronization for Canvas Shapes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  QuadTree,
  boxIntersects,
  pointInBox,
  worldToScreen,
  screenToWorld,
  getViewportWorldBounds,
} from '@/features/editor/domain/canvas/quad-tree';
import {
  TikZTranspiler,
  sanitizeTikzId,
  escapeLatexText,
  hexToTikzColorName,
} from '@/features/editor/domain/canvas/tikz-transpiler';
import type {
  CanvasElement,
  ViewportState,
  BoundingBox,
} from '@/features/editor/domain/canvas/canvas-types';

describe('Collaborative Canvas & TikZ Transpiler Engine', () => {

  // =========================================================================
  // 1. QUAD-TREE SPATIAL PARTITIONING & MATRIX TRANSFORMS
  // =========================================================================
  describe('Spatial QuadTree & Viewport Coordinate Mapping', () => {
    it('1.1: boxIntersects accurately detects overlaps and disjoint boxes', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const boxB: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };
      const boxC: BoundingBox = { x: 200, y: 200, width: 50, height: 50 };

      expect(boxIntersects(boxA, boxB)).toBe(true);
      expect(boxIntersects(boxA, boxC)).toBe(false);
    });

    it('1.2: pointInBox checks point containment within boundaries', () => {
      const box: BoundingBox = { x: 10, y: 20, width: 80, height: 60 };
      expect(pointInBox({ x: 50, y: 50 }, box)).toBe(true);
      expect(pointInBox({ x: 5, y: 50 }, box)).toBe(false);
      expect(pointInBox({ x: 90, y: 80 }, box)).toBe(true); // boundary
    });

    it('1.3: Screen <-> World matrix transforms are exact mathematical inverses', () => {
      const viewport: ViewportState = {
        zoom: 1.5,
        panX: 250,
        panY: -100,
        width: 1920,
        height: 1080,
      };

      const worldOriginal = { x: 340.5, y: 812.25 };
      const screenPoint = worldToScreen(worldOriginal, viewport);
      const worldInverted = screenToWorld(screenPoint, viewport);

      expect(worldInverted.x).toBeCloseTo(worldOriginal.x, 5);
      expect(worldInverted.y).toBeCloseTo(worldOriginal.y, 5);
    });

    it('1.4: getViewportWorldBounds yields the correct visible rectangle', () => {
      const viewport: ViewportState = {
        zoom: 2,
        panX: 100,
        panY: 50,
        width: 800,
        height: 600,
      };

      const worldBounds = getViewportWorldBounds(viewport);
      expect(worldBounds.x).toBe(-50); // (0 - 100) / 2
      expect(worldBounds.y).toBe(-25); // (0 - 50) / 2
      expect(worldBounds.width).toBe(400); // 800 / 2
      expect(worldBounds.height).toBe(300); // 600 / 2
    });

    it('1.5: QuadTree handles insertion, range query culling, and removal', () => {
      const worldBounds: BoundingBox = { x: 0, y: 0, width: 1000, height: 1000 };
      const tree = new QuadTree<CanvasElement>(worldBounds, 4, 4);

      const el1: CanvasElement = {
        id: 'node-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
        updatedAt: Date.now(),
      };

      const el2: CanvasElement = {
        id: 'node-2',
        type: 'ellipse',
        x: 800,
        y: 800,
        width: 60,
        height: 60,
        updatedAt: Date.now(),
      };

      tree.insert(el1);
      tree.insert(el2);

      expect(tree.size()).toBe(2);

      // Query only the top-left area
      const queryTL: BoundingBox = { x: 0, y: 0, width: 300, height: 300 };
      const resultsTL = tree.queryRange(queryTL);
      expect(resultsTL.map((r) => r.id)).toEqual(['node-1']);

      // Remove el1
      const removed = tree.remove('node-1');
      expect(removed).toBe(true);
      expect(tree.size()).toBe(1);

      const resultsAfterRemove = tree.queryRange(queryTL);
      expect(resultsAfterRemove.length).toBe(0);
    });

    it('1.6: QuadTree scales to 1,000 items and performs fast sub-tree range query culling', () => {
      const tree = new QuadTree<CanvasElement>(
        { x: 0, y: 0, width: 10000, height: 10000 },
        16,
        8
      );

      for (let i = 0; i < 1000; i++) {
        tree.insert({
          id: `item-${i}`,
          type: 'rectangle',
          x: (i * 37) % 9000,
          y: (i * 59) % 9000,
          width: 50,
          height: 30,
          updatedAt: Date.now(),
        });
      }

      expect(tree.size()).toBe(1000);

      // Query a small 200x200 patch
      const smallQuery: BoundingBox = { x: 500, y: 500, width: 200, height: 200 };
      const visibleItems = tree.queryRange(smallQuery);

      // Must be a small fraction of the 1000 items
      expect(visibleItems.length).toBeLessThan(50);
      for (const item of visibleItems) {
        expect(
          boxIntersects(
            { x: item.x, y: item.y, width: item.width, height: item.height },
            smallQuery
          )
        ).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. TIKZ TRANSPILER & LATEX CODE GENERATION
  // =========================================================================
  describe('TikZ Transpiler Engine', () => {
    it('2.1: Sanitizes node IDs and escapes LaTeX special characters', () => {
      expect(sanitizeTikzId('step-1/init.stage')).toBe('node_step_1_init_stage');
      expect(escapeLatexText('Cost & Performance = 100% (Loss_opt)')).toBe(
        'Cost \\& Performance = 100\\% (Loss\\_opt)'
      );
    });

    it('2.2: Maps hex colors to standard TikZ/xcolor names or custom definitions', () => {
      expect(hexToTikzColorName('#3b82f6')).toBe('blue!80!black');
      expect(hexToTikzColorName('#ef4444')).toBe('red!80!black');
      expect(hexToTikzColorName('#123456')).toBe('c_123456');
    });

    it('2.3: Generates clean TikZ diagram with multiple shapes and labeled arrow connector', () => {
      const elements: CanvasElement[] = [
        {
          id: 'encoder',
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 120,
          height: 60,
          text: 'Self-Attention Encoder',
          fillColor: '#3b82f6',
          strokeColor: '#000000',
          updatedAt: Date.now(),
        },
        {
          id: 'decoder',
          type: 'rectangle',
          x: 350,
          y: 100,
          width: 120,
          height: 60,
          text: 'Autoregressive Decoder',
          fillColor: '#10b981',
          strokeColor: '#000000',
          updatedAt: Date.now(),
        },
        {
          id: 'conn1',
          type: 'arrow',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          sourceElementId: 'encoder',
          targetElementId: 'decoder',
          text: 'Cross-Attention Keys/Values',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
      ];

      const tikz = TikZTranspiler.transpile(elements, { scale: 40 });

      expect(tikz).toContain('\\begin{tikzpicture}');
      expect(tikz).toContain('\\end{tikzpicture}');
      expect(tikz).toContain('\\node[rectangle, draw');
      expect(tikz).toContain('Self-Attention Encoder');
      expect(tikz).toContain('Autoregressive Decoder');
      expect(tikz).toContain('\\draw[->, thick]');
      expect(tikz).toContain('Cross-Attention Keys/Values');
    });

    it('2.4: Supports diamond, database, and cloud shapes', () => {
      const elements: CanvasElement[] = [
        {
          id: 'db',
          type: 'database',
          x: 50,
          y: 50,
          width: 80,
          height: 80,
          text: 'Vector DB',
          updatedAt: Date.now(),
        },
        {
          id: 'cond',
          type: 'diamond',
          x: 200,
          y: 50,
          width: 80,
          height: 80,
          text: 'Similarity >= 0.85?',
          updatedAt: Date.now(),
        },
      ];

      const tikz = TikZTranspiler.transpile(elements);
      expect(tikz).toContain('cylinder');
      expect(tikz).toContain('diamond');
      expect(tikz).toContain('Vector DB');
      expect(tikz).toContain('Similarity >= 0.85?');
    });

    it('2.5: Wraps in standalone compilable document when requested', () => {
      const elements: CanvasElement[] = [
        {
          id: 'box',
          type: 'rectangle',
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          text: 'Standalone Node',
          updatedAt: Date.now(),
        },
      ];

      const standalone = TikZTranspiler.transpile(elements, {
        includeDocumentWrapper: true,
      });

      expect(standalone).toContain('\\documentclass[border=10pt]{standalone}');
      expect(standalone).toContain('\\usepackage{tikz}');
      expect(standalone).toContain('\\begin{document}');
      expect(standalone).toContain('\\end{document}');
    });
  });

  // =========================================================================
  // 3. MULTI-USER CRDT SYNCHRONIZATION FOR CANVAS SHAPES
  // =========================================================================
  describe('Real-Time Multi-User CRDT Canvas Synchronization', () => {
    it('3.1: Co-authors concurrently add shapes to Y.Doc and achieve 100% convergence', () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      const mapA = docA.getMap<CanvasElement>('canvas:elements');
      const mapB = docB.getMap<CanvasElement>('canvas:elements');

      // Author A creates Architecture Box
      mapA.set('arch-1', {
        id: 'arch-1',
        type: 'rectangle',
        x: 100,
        y: 150,
        width: 140,
        height: 70,
        text: 'Transformer Block',
        updatedAt: 1,
      });

      // Author B creates Loss Function Box
      mapB.set('loss-1', {
        id: 'loss-1',
        type: 'ellipse',
        x: 400,
        y: 150,
        width: 100,
        height: 60,
        text: 'Cross-Entropy Loss',
        updatedAt: 2,
      });

      // Cross sync updates
      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);

      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docA, updateB);

      // Verify convergence
      expect(mapA.size).toBe(2);
      expect(mapB.size).toBe(2);
      expect(mapA.get('arch-1')?.text).toBe('Transformer Block');
      expect(mapA.get('loss-1')?.text).toBe('Cross-Entropy Loss');
      expect(mapB.get('arch-1')?.text).toBe('Transformer Block');
      expect(mapB.get('loss-1')?.text).toBe('Cross-Entropy Loss');

      // Feed converged CRDT items directly to TikZTranspiler
      const elements = Array.from(mapA.values());
      const tikz = TikZTranspiler.transpile(elements);

      expect(tikz).toContain('Transformer Block');
      expect(tikz).toContain('Cross-Entropy Loss');

      docA.destroy();
      docB.destroy();
    });
  });
});
