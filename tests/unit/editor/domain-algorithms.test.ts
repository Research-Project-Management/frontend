/**
 * domain-algorithms.test.ts
 *
 * Comprehensive Unit Tests for Flux Editor Domain Algorithms:
 * 1. Bounded LRU Document Cache (O(1) touch/evict/read, dirty persistence).
 * 2. LaTeX DAG Engine (Include resolution, Cycle detection, Root inference).
 * 3. Diagnostics Coordinator (File-partitioned binary search range queries).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LRUDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import {
  LatexDagEngine,
  normalizeLatexPath,
  resolveRelativeLatexPath,
} from '@/features/editor/domain/latex/latex-dag-engine';
import {
  DiagnosticsCoordinatorRegistry,
} from '@/features/editor/coordinators/diagnostics.coordinator';

describe('1. Bounded LRU Document Cache', () => {
  let cache: LRUDocumentCache;
  const evictedItems: Array<{ fileId: string; model: DocumentModelState }> = [];

  beforeEach(() => {
    evictedItems.length = 0;
    cache = new LRUDocumentCache();
    cache.setCapacity(3);
    cache.onEvict((fileId, model) => {
      evictedItems.push({ fileId, model });
    });
  });

  it('maintains bounded capacity and evicts least recently used file', () => {
    cache.registerModel('file1', { filePath: 'main.tex', content: 'Doc 1' });
    cache.registerModel('file2', { filePath: 'intro.tex', content: 'Doc 2' });
    cache.registerModel('file3', { filePath: 'methods.tex', content: 'Doc 3' });

    expect(cache.getStats().size).toBe(3);

    // Access file1 to make it Most Recently Used (MRU)
    cache.getModel('file1');

    // Insert file4 -> Capacity exceeded -> file2 should be evicted (as file1 was touched and file3 was newer than file2)
    cache.registerModel('file4', { filePath: 'results.tex', content: 'Doc 4' });

    expect(cache.getStats().size).toBe(3);
    expect(cache.hasModel('file2')).toBe(false);
    expect(cache.hasModel('file1')).toBe(true);
    expect(cache.hasModel('file3')).toBe(true);
    expect(cache.hasModel('file4')).toBe(true);
    expect(evictedItems).toHaveLength(1);
    expect(evictedItems[0].fileId).toBe('file2');
  });

  it('correctly tracks and updates cursor selections and viewports', () => {
    cache.registerModel('file1', { filePath: 'main.tex', content: 'Hello World' });

    cache.updateViewState('file1', { anchor: 5, head: 5 }, { top: 120, left: 0 });
    const model = cache.getModel('file1');

    expect(model?.selection).toEqual({ anchor: 5, head: 5 });
    expect(model?.scrollViewport).toEqual({ top: 120, left: 0 });
  });
});

describe('2. LaTeX DAG Engine & Root Document Inference', () => {
  it('correctly normalizes LaTeX file paths', () => {
    expect(normalizeLatexPath('chapters/intro.tex')).toBe('chapters/intro.tex');
    expect(normalizeLatexPath('chapters/intro')).toBe('chapters/intro.tex');
    expect(resolveRelativeLatexPath('figures', '../main.tex')).toBe('main.tex');
  });

  it('builds include graph and detects cycles via DFS 3-coloring', () => {
    const dag = new LatexDagEngine();

    // Cyclic graph: A -> B -> C -> A
    dag.parseAndRegister('a.tex', '\\include{b}');
    dag.parseAndRegister('b.tex', '\\input{c}');
    dag.parseAndRegister('c.tex', '\\input{a}');

    const cycles = dag.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('infers root document through reverse DAG backtracking', () => {
    const dag = new LatexDagEngine();

    // Project structure:
    // main.tex (\documentclass{article}, \include{chapters/intro})
    // chapters/intro.tex (\input{sections/sec1})
    // sections/sec1.tex (plain text)
    dag.parseAndRegister('main.tex', '\\documentclass{article}\n\\begin{document}\n\\include{chapters/intro}\n\\end{document}');
    dag.parseAndRegister('chapters/intro.tex', '\\input{sections/sec1}');
    dag.parseAndRegister('sections/sec1.tex', 'This is section 1 content.');

    // No cycles in this valid project
    expect(dag.detectCycles().length).toBe(0);

    // Query root when currently editing a leaf document
    const inferredRoot = dag.inferRootDocument('sections/sec1.tex');
    expect(inferredRoot.rootPath).toBe('main.tex');
  });
});

describe('3. Diagnostics Coordinator (Interval Partitioning)', () => {
  it('partitions diagnostics by file and performs O(log K) range queries', () => {
    const coordinator = new DiagnosticsCoordinatorRegistry();

    const mockErrors = [
      { file: 'main.tex', line: 10, message: 'Undefined control sequence', severity: 'error' as const },
      { file: 'main.tex', line: 45, message: 'Overfull \\hbox', severity: 'warning' as const },
      { file: 'main.tex', line: 80, message: 'Reference undefined', severity: 'warning' as const },
      { file: 'chapters/intro.tex', line: 15, message: 'Syntax error', severity: 'error' as const },
    ];

    coordinator.ingestCompilerErrors(mockErrors);

    // Verify file partition isolation (No leakage from intro.tex to main.tex)
    const mainDiagnostics = coordinator.getFileDiagnostics('main.tex');
    expect(mainDiagnostics).toHaveLength(3);

    const introDiagnostics = coordinator.getFileDiagnostics('chapters/intro.tex');
    expect(introDiagnostics).toHaveLength(1);
    expect(introDiagnostics[0].line).toBe(15);

    // Viewport range query: Query lines 30 to 60 in main.tex
    const viewportRange = coordinator.findDiagnosticsInRange('main.tex', 30, 60);
    expect(viewportRange).toHaveLength(1);
    expect(viewportRange[0].line).toBe(45);

    // Summary counts
    const summary = coordinator.getFileSummary('main.tex');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(2);
    expect(summary.total).toBe(3);
  });
});
