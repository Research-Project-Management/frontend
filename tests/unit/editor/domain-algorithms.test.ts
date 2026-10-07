/**
 * domain-algorithms.test.ts
 *
 * Comprehensive Unit Tests for Flux Editor Domain Algorithms:
 * 1. Bounded LRU Document Cache (O(1) touch/evict/read, dirty persistence).
 * 2. LaTeX DAG Engine (Include resolution, Cycle detection, Root inference).
 * 3. Diagnostics Coordinator (File-partitioned binary search range queries).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LRUDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/lru-document-cache';
import {
  LatexDagResolver,
  normalizeLatexPath,
} from '@/features/editor/domain/latex-dag-engine';
import {
  DiagnosticsCoordinatorRegistry,
  type IndexedDiagnosticItem,
} from '@/features/editor/coordinators/diagnostics.coordinator';

describe('1. Bounded LRU Document Cache', () => {
  let cache: LRUDocumentCache;
  const evictedItems: Array<{ fileId: string; model: DocumentModelState }> = [];

  beforeEach(() => {
    evictedItems.length = 0;
    cache = new LRUDocumentCache({
      capacity: 3,
      onEvict: (fileId, model) => {
        evictedItems.push({ fileId, model });
      },
    });
  });

  it('maintains bounded capacity and evicts least recently used file', () => {
    cache.set('file1', { fileId: 'file1', filePath: 'main.tex', content: 'Doc 1', isDirty: false, lastActiveAt: Date.now() });
    cache.set('file2', { fileId: 'file2', filePath: 'intro.tex', content: 'Doc 2', isDirty: false, lastActiveAt: Date.now() });
    cache.set('file3', { fileId: 'file3', filePath: 'methods.tex', content: 'Doc 3', isDirty: false, lastActiveAt: Date.now() });

    expect(cache.size).toBe(3);

    // Access file1 to make it Most Recently Used (MRU)
    cache.get('file1');

    // Insert file4 -> Capacity exceeded -> file2 should be evicted (as file1 was touched and file3 was newer than file2)
    cache.set('file4', { fileId: 'file4', filePath: 'results.tex', content: 'Doc 4', isDirty: false, lastActiveAt: Date.now() });

    expect(cache.size).toBe(3);
    expect(cache.has('file2')).toBe(false);
    expect(cache.has('file1')).toBe(true);
    expect(cache.has('file3')).toBe(true);
    expect(cache.has('file4')).toBe(true);
    expect(evictedItems).toHaveLength(1);
    expect(evictedItems[0].fileId).toBe('file2');
  });

  it('correctly tracks and updates cursor selections and viewports', () => {
    cache.set('file1', { fileId: 'file1', filePath: 'main.tex', content: 'Hello World', isDirty: false, lastActiveAt: Date.now() });

    cache.updateViewState('file1', { anchor: 5, head: 5 }, { top: 120, left: 0 });
    const model = cache.get('file1');

    expect(model?.selection).toEqual({ anchor: 5, head: 5 });
    expect(model?.scrollViewport).toEqual({ top: 120, left: 0 });
  });
});

describe('2. LaTeX DAG Engine & Root Document Inference', () => {
  it('correctly normalizes LaTeX file paths', () => {
    expect(normalizeLatexPath('chapters/intro.tex')).toBe('chapters/intro.tex');
    expect(normalizeLatexPath('chapters/intro')).toBe('chapters/intro.tex');
    expect(normalizeLatexPath('./figures/../main.tex')).toBe('main.tex');
  });

  it('builds include graph and detects cycles via DFS 3-coloring', () => {
    const dag = new LatexDagResolver();

    // Cyclic graph: A -> B -> C -> A
    dag.registerFile('a.tex', '\\include{b}');
    dag.registerFile('b.tex', '\\input{c}');
    dag.registerFile('c.tex', '\\input{a}');

    const cycleResult = dag.detectCycle();
    expect(cycleResult.hasCycle).toBe(true);
    expect(cycleResult.cyclePath.length).toBeGreaterThan(0);
  });

  it('infers root document through reverse DAG backtracking', () => {
    const dag = new LatexDagResolver();

    // Project structure:
    // main.tex (\documentclass{article}, \include{chapters/intro})
    // chapters/intro.tex (\input{sections/sec1})
    // sections/sec1.tex (plain text)
    dag.registerFile('main.tex', '\\documentclass{article}\n\\begin{document}\n\\include{chapters/intro}\n\\end{document}');
    dag.registerFile('chapters/intro.tex', '\\input{sections/sec1}');
    dag.registerFile('sections/sec1.tex', 'This is section 1 content.');

    // No cycles in this valid project
    expect(dag.detectCycle().hasCycle).toBe(false);

    // Query root when currently editing a leaf document
    const inferredRoot = dag.inferRootDocument('sections/sec1.tex');
    expect(inferredRoot).toBe('main.tex');
  });
});

describe('3. Diagnostics Coordinator (Interval Partitioning)', () => {
  it('partitions diagnostics by file and performs O(log K) range queries', () => {
    const coordinator = new DiagnosticsCoordinatorRegistry();

    const mockErrors: IndexedDiagnosticItem[] = [
      { id: '1', file: 'main.tex', line: 10, column: 5, message: 'Undefined control sequence', severity: 'error', source: 'LaTeX Compiler' },
      { id: '2', file: 'main.tex', line: 45, column: 1, message: 'Overfull \\hbox', severity: 'warning', source: 'LaTeX Compiler' },
      { id: '3', file: 'main.tex', line: 80, column: 2, message: 'Reference undefined', severity: 'warning', source: 'LaTeX Compiler' },
      { id: '4', file: 'chapters/intro.tex', line: 15, column: 0, message: 'Syntax error', severity: 'error', source: 'LaTeX Compiler' },
    ];

    coordinator.ingestDiagnostics(mockErrors);

    // Verify file partition isolation (No leakage from intro.tex to main.tex)
    const mainDiagnostics = coordinator.getFileDiagnostics('main.tex');
    expect(mainDiagnostics).toHaveLength(3);

    const introDiagnostics = coordinator.getFileDiagnostics('chapters/intro.tex');
    expect(introDiagnostics).toHaveLength(1);
    expect(introDiagnostics[0].line).toBe(15);

    // Viewport range query: Query lines 30 to 60 in main.tex
    const viewportRange = coordinator.queryRange('main.tex', 30, 60);
    expect(viewportRange).toHaveLength(1);
    expect(viewportRange[0].line).toBe(45);

    // Summary counts
    const summary = coordinator.getFileSummary('main.tex');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(2);
    expect(summary.total).toBe(3);
  });
});
