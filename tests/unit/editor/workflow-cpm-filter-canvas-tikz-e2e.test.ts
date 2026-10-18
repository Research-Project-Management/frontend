/**
 * workflow-cpm-filter-canvas-tikz-e2e.test.ts
 *
 * Full-Lifecycle End-to-End Workflow Verification:
 * 1. Project Planning & CPM Dependency Engine:
 *    - Models realistic academic project work items with dependencies.
 *    - Computes Forward/Backward pass, slack, and critical path.
 *
 * 2. High-Performance Inverted Index & Bitset Filtering:
 *    - Indexes work items with FastBitset and prefix token index.
 *    - Executes multi-criteria queries with sub-millisecond Bitset intersection.
 *
 * 3. Collaborative Diagram Canvas & QuadTree Spatial Indexing:
 *    - Converts CPM milestone & system architecture into interactive Canvas Elements.
 *    - Indexes elements in QuadTree and tests viewport spatial culling.
 *    - Validates multi-actor concurrent CRDT canvas mutation & state convergence.
 *
 * 4. AST TikZ Transpilation:
 *    - Transpiles canvas elements and connectors into clean, idiomatic LaTeX/TikZ code.
 *    - Verifies math/string escaping, valid coordinates, node styles, and arrows.
 *
 * 5. Direct Insertion into LaTeX Editor, Yjs CRDT Synchronization & Session Coordination:
 *    - Dispatches insertion via `editorCommandBus`.
 *    - Verifies active engine receives text insertion and focus.
 *    - Synchronizes across multiple Yjs clients with Strong Eventual Consistency.
 *    - Verifies session flush and cross-reference figure label registration in symbol index.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';

// CPM & Work Item Engine
import {
  analyzeCriticalPath,
  calculateTaskDuration,
  extractNormalizedEdges,
  type CpmAnalysisResult,
} from '@/features/projects/project-id/work-items/utils/cpm-graph';
import {
  WorkItemFilterEngine,
  FastBitset,
  type WorkItemFilterQuery,
} from '@/features/projects/project-id/work-items/utils/work-item-filter-engine';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';

// Canvas & TikZ Transpiler
import { QuadTree, screenToWorld, worldToScreen } from '@/features/editor/domain/canvas/quad-tree';
import { TikZTranspiler } from '@/features/editor/domain/canvas/tikz-transpiler';
import type { CanvasElement } from '@/features/editor/domain/canvas/canvas-types';

// Editor Coordinators & Core Bus
import {
  editorCommandBus,
  setActiveEditorEngine,
  getActiveEditorEngine,
} from '@/features/editor/core';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

describe('End-to-End Workflow Verification: CPM -> Bitset Filter -> Canvas -> TikZ -> LaTeX Editor', () => {
  // Test project items for an academic research paper workflow
  let projectItems: Item[];
  let filterEngine: WorkItemFilterEngine;
  let mockEngine: IEditorEngine & { insertedSnippets: string[]; isFocused: boolean; content: string };

  beforeEach(() => {
    vi.clearAllMocks();
    latexSymbolsIndex.clear();
    editorCommandBus.clear();

    // Re-attach core bridges on command bus
    editorCommandBus.subscribe('editor:insert-text', (cmd) => {
      getActiveEditorEngine()?.insertText(cmd.text);
    });
    editorCommandBus.subscribe('editor:focus', () => {
      getActiveEditorEngine()?.focus();
    });

    mockEngine = {
      content: [
        '\\documentclass{article}',
        '\\usepackage{tikz}',
        '\\begin{document}',
        '\\section{System Architecture}',
        'The overall pipeline is depicted below:',
        '% DIAGRAM_TARGET_LOCATION',
        '\\section{Evaluation & Results}',
        'Empirical measurements demonstrate sub-millisecond query responsiveness.',
        '\\end{document}',
      ].join('\n'),
      insertedSnippets: [] as string[],
      isFocused: false,
      getContent() {
        return this.content;
      },
      setContent(c: string) {
        this.content = c;
      },
      getSelection() {
        return null;
      },
      getSelectedText() {
        return '';
      },
      insertText(text: string) {
        this.insertedSnippets.push(text);
        this.content = this.content.replace('% DIAGRAM_TARGET_LOCATION', `${text}\n% DIAGRAM_TARGET_LOCATION`);
      },
      wrapSelection() {},
      format() {},
      jumpToLine() {},
      undo() {},
      redo() {},
      focus() {
        this.isFocused = true;
      },
      getCursorPosition() {
        return { line: 6, column: 1 };
      },
    } as any;

    setActiveEditorEngine(mockEngine);

    // 8 Realistic Academic Project Tasks
    projectItems = [
      {
        id: 'task-1' as any,
        title: 'Literature Survey & Related Work',
        identifier: 'RES-01',
        columnId: 'col-done',
        priority: 'medium',
        assigneeId: 'user-carol',
        startDate: '2026-09-01',
        dueDate: '2026-09-05', // 5 days
        relations: [{ id: 'r1', type: 'blocks', targetWorkItemId: 'task-2' }] as any,
        labels: ['research', 'milestone'],
        completed: true,
      },
      {
        id: 'task-2' as any,
        title: 'Mathematical Formalization & Complexity Proofs',
        identifier: 'RES-02',
        columnId: 'col-done',
        priority: 'high',
        assigneeId: 'user-alice',
        startDate: '2026-09-06',
        dueDate: '2026-09-12', // 7 days
        relations: [
          { id: 'r2', type: 'blocks', targetWorkItemId: 'task-3' },
          { id: 'r3', type: 'blocks', targetWorkItemId: 'task-4' },
        ] as any,
        labels: ['theory', 'math'],
        completed: true,
      },
      {
        id: 'task-3' as any,
        title: 'Inverted Index & FastBitset Filtering Engine',
        identifier: 'RES-03',
        columnId: 'col-in-progress',
        priority: 'urgent',
        assigneeId: 'user-bob',
        startDate: '2026-09-13',
        dueDate: '2026-09-22', // 10 days
        relations: [{ id: 'r4', type: 'blocks', targetWorkItemId: 'task-5' }] as any,
        labels: ['engine', 'bitset', 'algorithms'],
        completed: false,
      },
      {
        id: 'task-4' as any,
        title: 'QuadTree Spatial Indexing & Viewport Culler',
        identifier: 'RES-04',
        columnId: 'col-in-progress',
        priority: 'high',
        assigneeId: 'user-alice',
        startDate: '2026-09-13',
        dueDate: '2026-09-18', // 6 days
        relations: [{ id: 'r5', type: 'blocks', targetWorkItemId: 'task-5' }] as any,
        labels: ['spatial', 'quadtree', 'graphics'],
        completed: false,
      },
      {
        id: 'task-5' as any,
        title: 'TikZ Architecture Diagram & Collaborative Canvas',
        identifier: 'RES-05',
        columnId: 'col-todo',
        priority: 'urgent',
        assigneeId: 'user-bob',
        startDate: '2026-09-23',
        dueDate: '2026-09-28', // 6 days
        relations: [
          { id: 'r6', type: 'blocks', targetWorkItemId: 'task-6' },
          { id: 'r7', type: 'blocks', targetWorkItemId: 'task-7' },
        ] as any,
        labels: ['canvas', 'tikz', 'architecture', 'milestone'],
        completed: false,
      },
      {
        id: 'task-6' as any,
        title: 'Stress Testing & Concurrency Profiling Suite',
        identifier: 'RES-06',
        columnId: 'col-todo',
        priority: 'high',
        assigneeId: 'user-alice',
        startDate: '2026-09-29',
        dueDate: '2026-10-02', // 4 days
        relations: [{ id: 'r8', type: 'blocks', targetWorkItemId: 'task-8' }] as any,
        labels: ['testing', 'benchmarks', 'concurrency'],
        completed: false,
      },
      {
        id: 'task-7' as any,
        title: 'Drafting Main LaTeX Manuscript & Figures',
        identifier: 'RES-07',
        columnId: 'col-todo',
        priority: 'urgent',
        assigneeId: 'user-carol',
        startDate: '2026-09-29',
        dueDate: '2026-10-06', // 8 days
        relations: [{ id: 'r9', type: 'blocks', targetWorkItemId: 'task-8' }] as any,
        labels: ['manuscript', 'latex', 'writing'],
        completed: false,
      },
      {
        id: 'task-8' as any,
        title: 'Final Camera-Ready Submission to ACM Conference',
        identifier: 'RES-08',
        columnId: 'col-todo',
        priority: 'urgent',
        assigneeId: 'user-alice',
        startDate: '2026-10-07',
        dueDate: '2026-10-08', // 2 days
        relations: [] as any,
        labels: ['submission', 'camera-ready', 'milestone'],
        completed: false,
      },
    ] as unknown as Item[];

    filterEngine = new WorkItemFilterEngine(projectItems, []);
  });

  afterEach(() => {
    setActiveEditorEngine(null);
    latexSymbolsIndex.clear();
  });

  // ===========================================================================
  // 1. CPM DEPENDENCY GRAPH & CRITICAL PATH ANALYSIS
  // ===========================================================================
  describe('Phase 1: CPM Project Planning & DAG Critical Path Analysis', () => {
    it('analyzes project dependency graph and identifies the exact critical path', () => {
      const cpmResult: CpmAnalysisResult = analyzeCriticalPath(projectItems);

      // 1.1 Verify DAG properties (no cycles)
      expect(cpmResult.hasCycle).toBe(false);
      expect(cpmResult.cycleNodeIds).toHaveLength(0);
      expect(cpmResult.topologicalOrder).toHaveLength(8);

      // 1.2 Verify topological sequence ordering
      const order = cpmResult.topologicalOrder;
      expect(order.indexOf('task-1')).toBeLessThan(order.indexOf('task-2'));
      expect(order.indexOf('task-2')).toBeLessThan(order.indexOf('task-3'));
      expect(order.indexOf('task-2')).toBeLessThan(order.indexOf('task-4'));
      expect(order.indexOf('task-3')).toBeLessThan(order.indexOf('task-5'));
      expect(order.indexOf('task-4')).toBeLessThan(order.indexOf('task-5'));
      expect(order.indexOf('task-5')).toBeLessThan(order.indexOf('task-6'));
      expect(order.indexOf('task-5')).toBeLessThan(order.indexOf('task-7'));
      expect(order.indexOf('task-6')).toBeLessThan(order.indexOf('task-8'));
      expect(order.indexOf('task-7')).toBeLessThan(order.indexOf('task-8'));

      // 1.3 Verify critical path computation
      // Duration breakdown:
      // T1 (5) -> T2 (7) -> T3 (10) vs T4 (6) -> T5 (6) -> T7 (8) vs T6 (4) -> T8 (2)
      // Path via T3: 5 + 7 + 10 + 6 + 8 + 2 = 38 days.
      // Path via T4: 5 + 7 + 6 + 6 + 8 + 2 = 34 days (has slack = 4 days).
      // Path via T6: 5 + 7 + 10 + 6 + 4 + 2 = 34 days (has slack = 4 days).
      expect(cpmResult.projectDurationDays).toBe(38);

      const criticalIds = Array.from(cpmResult.criticalPathItemIds);
      expect(criticalIds).toContain('task-1');
      expect(criticalIds).toContain('task-2');
      expect(criticalIds).toContain('task-3');
      expect(criticalIds).toContain('task-5'); // Diagram milestone is on the critical path!
      expect(criticalIds).toContain('task-7');
      expect(criticalIds).toContain('task-8');

      // T4 and T6 must have positive float/slack
      const node4 = cpmResult.nodes.get('task-4')!;
      expect(node4.isCritical).toBe(false);
      expect(node4.slackDays).toBeGreaterThan(0);

      const node6 = cpmResult.nodes.get('task-6')!;
      expect(node6.isCritical).toBe(false);
      expect(node6.slackDays).toBeGreaterThan(0);

      // T5 (TikZ milestone) must have 0 slack
      const node5 = cpmResult.nodes.get('task-5')!;
      expect(node5.isCritical).toBe(true);
      expect(node5.slackDays).toBe(0);
    });
  });

  // ===========================================================================
  // 2. INVERTED INDEX & BITSET FILTERING ENGINE
  // ===========================================================================
  describe('Phase 2: Ultra-Fast Bitset Multi-Criteria Filtering', () => {
    it('locates the TikZ diagram milestone instantly using prefix search & compound filters', () => {
      // 2.1 Prefix token search for "TikZ"
      const prefixResults = filterEngine.executeFilter({}, 'TikZ');
      expect(prefixResults).toHaveLength(1);
      expect(prefixResults[0].id).toBe('task-5');
      expect(prefixResults[0].title).toContain('TikZ Architecture Diagram');

      // 2.2 Compound query: priority 'urgent' + label 'milestone' + search 'Architecture'
      const compoundResults = filterEngine.executeFilter(
        {
          priority: ['urgent'],
          labels: ['milestone'],
        },
        'Architecture'
      );
      expect(compoundResults).toHaveLength(1);
      expect(compoundResults[0].id).toBe('task-5');

      // Repeat query 50 times to verify no bitset leakage
      for (let i = 0; i < 50; i++) {
        const res = filterEngine.executeFilter({}, 'diagram');
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('task-5');
      }
    });
  });

  // ===========================================================================
  // 3. COLLABORATIVE DIAGRAM CANVAS & QUADTREE SPATIAL CULLING
  // ===========================================================================
  describe('Phase 3: Interactive Infinite Canvas, QuadTree Index & Multi-Actor CRDT Sync', () => {
    it('constructs spatial diagram, executes viewport culling, and merges concurrent CRDT edits', () => {
      // 3.1 Model Architecture Nodes on Canvas
      const nodes: CanvasElement[] = [
        {
          id: 'node_store',
          type: 'database',
          x: 100,
          y: 200,
          width: 140,
          height: 80,
          text: 'Work Item Store',
          fillColor: '#3b82f6',
          strokeColor: '#000000',
          strokeWidth: 2,
          updatedAt: Date.now(),
        },
        {
          id: 'node_bitset',
          type: 'diamond',
          x: 350,
          y: 190,
          width: 140,
          height: 100,
          text: 'Bitset & Inverted Index',
          fillColor: '#10b981',
          strokeColor: '#000000',
          strokeWidth: 2,
          updatedAt: Date.now(),
        },
        {
          id: 'node_quadtree',
          type: 'rectangle',
          x: 600,
          y: 200,
          width: 150,
          height: 80,
          text: 'QuadTree Spatial Culler',
          fillColor: '#8b5cf6',
          strokeColor: '#000000',
          strokeWidth: 2,
          updatedAt: Date.now(),
        },
        {
          id: 'node_transpiler',
          type: 'rectangle',
          x: 850,
          y: 200,
          width: 150,
          height: 80,
          text: 'TikZ LaTeX Transpiler',
          fillColor: '#f59e0b',
          strokeColor: '#000000',
          strokeWidth: 2,
          updatedAt: Date.now(),
        },
      ];

      // 3.2 Model Connecting Directional Arrows
      const arrows: CanvasElement[] = [
        {
          id: 'arrow_1',
          type: 'arrow',
          x: 240,
          y: 240,
          width: 110,
          height: 0,
          sourceElementId: 'node_store',
          targetElementId: 'node_bitset',
          text: 'Items',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
        {
          id: 'arrow_2',
          type: 'arrow',
          x: 490,
          y: 240,
          width: 110,
          height: 0,
          sourceElementId: 'node_bitset',
          targetElementId: 'node_quadtree',
          text: 'Filtered',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
        {
          id: 'arrow_3',
          type: 'arrow',
          x: 750,
          y: 240,
          width: 100,
          height: 0,
          sourceElementId: 'node_quadtree',
          targetElementId: 'node_transpiler',
          text: 'Culled AST',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
      ];

      const allElements = [...nodes, ...arrows];

      // 3.3 Spatial Indexing with QuadTree
      const quadTree = new QuadTree({ x: 0, y: 0, width: 2000, height: 2000 }, 4, 8);
      for (const el of allElements) {
        quadTree.insert(el);
      }

      expect(quadTree.size()).toBe(7);

      // 3.4 Viewport Spatial Culling Test:
      // A zoomed-in viewport focused on x: [300, 550] (Center region)
      const centerViewport = { x: 300, y: 150, width: 250, height: 200 };
      const culledElements = quadTree.queryRange(centerViewport);

      const culledIds = new Set(culledElements.map((e) => e.id));
      expect(culledIds.has('node_bitset')).toBe(true);
      expect(culledIds.has('node_store')).toBe(false); // Off-screen to the left
      expect(culledIds.has('node_transpiler')).toBe(false); // Off-screen to the right

      // 3.5 Real-Time Collaborative CRDT Mutation & Synchronization
      const docClientA = new Y.Doc();
      const docClientB = new Y.Doc();
      const mapA = docClientA.getMap<CanvasElement>('canvas_elements');
      const mapB = docClientB.getMap<CanvasElement>('canvas_elements');

      // Populate Client A with initial elements
      for (const el of allElements) {
        mapA.set(el.id, el);
      }

      // Initial Handshake A -> B
      const initialUpdate = Y.encodeStateAsUpdate(docClientA);
      Y.applyUpdate(docClientB, initialUpdate);
      expect(mapB.size).toBe(7);

      // Client A modifies 'node_transpiler' text and position
      const transpilerEl = mapA.get('node_transpiler')!;
      mapA.set('node_transpiler', {
        ...transpilerEl,
        x: 900,
        text: 'TikZ Production Transpiler v2',
        updatedAt: Date.now(),
      });

      // Concurrent Client B adds a new destination node 'node_latex_editor' and an arrow
      const newEditorNode: CanvasElement = {
        id: 'node_latex_editor',
        type: 'rectangle',
        x: 1150,
        y: 200,
        width: 140,
        height: 80,
        text: 'CodeMirror 6 Editor',
        fillColor: '#ec4899',
        strokeColor: '#000000',
        strokeWidth: 2,
        updatedAt: Date.now(),
      };
      mapB.set('node_latex_editor', newEditorNode);

      const newArrow: CanvasElement = {
        id: 'arrow_4',
        type: 'arrow',
        x: 1040,
        y: 240,
        width: 110,
        height: 0,
        sourceElementId: 'node_transpiler',
        targetElementId: 'node_latex_editor',
        text: 'Inject Code',
        arrowEnd: true,
        updatedAt: Date.now(),
      };
      mapB.set('arrow_4', newArrow);

      // Bi-directional CRDT synchronization
      const updateAtoB = Y.encodeStateAsUpdate(docClientA, Y.encodeStateVector(docClientB));
      const updateBtoA = Y.encodeStateAsUpdate(docClientB, Y.encodeStateVector(docClientA));

      Y.applyUpdate(docClientB, updateAtoB);
      Y.applyUpdate(docClientA, updateBtoA);

      // Convergence Guarantee:
      expect(mapA.size).toBe(9);
      expect(mapB.size).toBe(9);
      expect(mapA.get('node_transpiler')?.text).toBe('TikZ Production Transpiler v2');
      expect(mapB.get('node_transpiler')?.text).toBe('TikZ Production Transpiler v2');
      expect(mapA.has('node_latex_editor')).toBe(true);
      expect(mapB.has('node_latex_editor')).toBe(true);
      expect(mapA.has('arrow_4')).toBe(true);

      docClientA.destroy();
      docClientB.destroy();
    });
  });

  // ===========================================================================
  // 4. AST TIKZ TRANSPILATION & LATEX SYNTAX VALIDATION
  // ===========================================================================
  describe('Phase 4: AST TikZ Transpilation into Valid LaTeX Code', () => {
    it('transpiles the multi-node canvas graph into production-grade TikZ code with escaped syntax', () => {
      const canvasElements: CanvasElement[] = [
        {
          id: 'comp_ingest',
          type: 'database',
          x: 100,
          y: 100,
          width: 120,
          height: 60,
          text: 'Database & Ingestion_v1', // Contains underscore and ampersand
          fillColor: '#3b82f6',
          strokeColor: '#000000',
          updatedAt: Date.now(),
        },
        {
          id: 'comp_bitset',
          type: 'diamond',
          x: 300,
          y: 90,
          width: 120,
          height: 80,
          text: 'FastBitset: O(1) & 100% Precision', // Contains colon, ampersand, percent
          fillColor: '#10b981',
          strokeColor: '#000000',
          updatedAt: Date.now(),
        },
        {
          id: 'comp_output',
          type: 'rectangle',
          x: 500,
          y: 100,
          width: 120,
          height: 60,
          text: 'TikZ AST Output',
          fillColor: '#8b5cf6',
          strokeColor: '#000000',
          updatedAt: Date.now(),
        },
        {
          id: 'arrow_ingest_bitset',
          type: 'arrow',
          x: 220,
          y: 130,
          width: 80,
          height: 0,
          sourceElementId: 'comp_ingest',
          targetElementId: 'comp_bitset',
          text: 'Stream_Data',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
        {
          id: 'arrow_bitset_output',
          type: 'arrow',
          x: 420,
          y: 130,
          width: 80,
          height: 0,
          sourceElementId: 'comp_bitset',
          targetElementId: 'comp_output',
          text: 'AST Nodes',
          arrowEnd: true,
          updatedAt: Date.now(),
        },
      ];

      const tikzLatex = TikZTranspiler.transpile(canvasElements, {
        scale: 40,
      });

      // 4.1 Check TikZ environment delimiters
      expect(tikzLatex).toContain('\\begin{tikzpicture}');
      expect(tikzLatex).toContain('\\end{tikzpicture}');

      // 4.2 Check node definitions and sanitized IDs
      expect(tikzLatex).toContain('(node_comp_ingest)');
      expect(tikzLatex).toContain('(node_comp_bitset)');
      expect(tikzLatex).toContain('(node_comp_output)');

      // 4.3 Check LaTeX character escaping (no unescaped _ or % or &)
      expect(tikzLatex).toContain('Database \\& Ingestion\\_v1');
      expect(tikzLatex).toContain('FastBitset: O(1) \\& 100\\% Precision');
      expect(tikzLatex).toContain('Stream\\_Data');

      // 4.4 Check drawing paths & arrows between nodes
      expect(tikzLatex).toContain('\\draw[->');
      expect(tikzLatex).toContain('(node_comp_ingest)');
      expect(tikzLatex).toContain('(node_comp_bitset)');
      expect(tikzLatex).toContain('(node_comp_output)');

      // 4.5 Verify mathematical validity of coordinates (no NaN, no undefined)
      expect(tikzLatex).not.toContain('NaN');
      expect(tikzLatex).not.toContain('undefined');
    });
  });

  // ===========================================================================
  // 5. DIRECT LATEX EDITOR INSERTION & MULTI-CLIENT CRDT CONVERGENCE
  // ===========================================================================
  describe('Phase 5: Insertion into LaTeX Editor, Yjs Sync & Pre-Compile Coordination', () => {
    it('executes full end-to-end integration: modal dispatch -> editor insertion -> CRDT sync -> symbol registration', async () => {
      // 5.1 Generate production-ready figure wrapper with TikZ code
      const generatedTikZ = [
        '\\begin{figure}[htbp]',
        '  \\centering',
        '  \\begin{tikzpicture}[>=stealth, font=\\small]',
        '    \\node[draw, rectangle, fill=blue!20] (n1) at (0,0) {Work Item Ingestion};',
        '    \\node[draw, diamond, fill=green!20] (n2) at (3,0) {Bitset Filter};',
        '    \\node[draw, rectangle, fill=purple!20] (n3) at (6,0) {QuadTree Culler};',
        '    \\draw[->, thick] (n1) -- (n2);',
        '    \\draw[->, thick] (n2) -- (n3);',
        '  \\end{tikzpicture}',
        '  \\caption{High-Performance Architecture Workflow}',
        '  \\label{fig:high_perf_arch}',
        '\\end{figure}',
      ].join('\n');

      // 5.2 Simulate ModernWorkbenchLayout modal callback:
      // When user clicks "Insert TikZ", modal dispatches:
      editorCommandBus.dispatch({
        type: 'editor:insert-text',
        text: `\n${generatedTikZ}\n`,
      });
      editorCommandBus.dispatch({ type: 'editor:focus' });

      // 5.3 Verify active editor engine received the text and focus
      expect(mockEngine.isFocused).toBe(true);
      expect(mockEngine.insertedSnippets).toHaveLength(1);
      expect(mockEngine.insertedSnippets[0]).toContain('\\label{fig:high_perf_arch}');

      const updatedEditorContent = mockEngine.getContent();
      expect(updatedEditorContent).toContain('\\begin{figure}[htbp]');
      expect(updatedEditorContent).toContain('\\label{fig:high_perf_arch}');
      expect(updatedEditorContent).toContain('\\end{figure}');

      // 5.4 Multi-Client Yjs Real-Time CRDT Synchronization:
      // Client A (who inserted the figure) and Client B (remote collaborator)
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const textA = docA.getText('latex');
      const textB = docB.getText('latex');

      // Hydrate with document content before insertion
      const initialDocText = [
        '\\documentclass{article}',
        '\\usepackage{tikz}',
        '\\begin{document}',
        '\\section{System Architecture}',
        'The architecture is shown below:',
        '\\section{Conclusion}',
        '\\end{document}',
      ].join('\n');

      textA.insert(0, initialDocText);
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      // Client A inserts the TikZ figure at line 5
      const insertIdx = textA.toString().indexOf('\\section{Conclusion}');
      textA.insert(insertIdx, `${generatedTikZ}\n\n`);

      // Concurrent Client B modifies Conclusion section text
      const conclusionIdx = textB.toString().indexOf('\\section{Conclusion}') + '\\section{Conclusion}\n'.length;
      textB.insert(conclusionIdx, 'We verified sub-millisecond execution times.\n');

      // Exchange binary CRDT updates
      const deltaAtoB = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
      const deltaBtoA = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

      Y.applyUpdate(docB, deltaAtoB);
      Y.applyUpdate(docA, deltaBtoA);

      // Verify Strong Eventual Consistency (SEC):
      expect(textA.toString()).toBe(textB.toString());
      expect(textA.toString()).toContain('\\label{fig:high_perf_arch}');
      expect(textA.toString()).toContain('We verified sub-millisecond execution times.');

      // 5.5 Pre-Compile Coordination & Symbol Table Registration:
      // Update LRU Document Cache and Latex Symbols Index
      const finalContent = textA.toString();
      lruDocumentCache.updateContent('main.tex', finalContent, false);

      // Parse and register new symbols into latexSymbolsIndex
      latexSymbolsIndex.indexFile('main.tex', 'main.tex', finalContent, true);

      // Verify cross-reference indexer discovered the new TikZ figure label
      const indexedLabels = latexSymbolsIndex.getLabels();
      const foundLabel = indexedLabels.find((l) => l.name === 'fig:high_perf_arch');
      expect(foundLabel).toBeDefined();
      expect(foundLabel?.sourceFile).toBe('main.tex');
      expect(foundLabel?.type).toBe('fig');

      // Verify Session Coordinator Pre-Compile Flush
      const flushResult = await sessionCoordinator.flushAllPending();
      expect(flushResult.failed).toBe(0);

      docA.destroy();
      docB.destroy();
    });
  });
});
