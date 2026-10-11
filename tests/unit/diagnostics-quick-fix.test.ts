import { describe, it, expect, beforeEach } from 'vitest';
import { diagnosticsCoordinator } from '@/features/editor/coordinators/diagnostics.coordinator';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';

describe('Diagnostics Intelligence & Compiler Error Quick-Fix (Overleaf Parity)', () => {
  beforeEach(() => {
    diagnosticsCoordinator.clear();
  });

  it('automatically enriches "undefined control sequence \\toprule" with booktabs package suggestion', () => {
    const errors: CompileError[] = [
      {
        line: 14,
        message: 'Undefined control sequence. \\toprule',
        context: 'l.14 \\toprule',
        file: 'main.tex',
        severity: 'error',
      },
    ];

    diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');
    const items = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');

    expect(items).toHaveLength(1);
    expect(items[0].suggestion).toContain('booktabs');
    expect(items[0].suggestion).toContain('\\usepackage{booktabs}');
    expect(items[0].fixedSnippet).toContain('booktabs');
    expect(items[0].confidence).toBe('high');
  });

  it('automatically enriches "missing $ inserted" error with math wrapping suggestion', () => {
    const errors: CompileError[] = [
      {
        line: 22,
        message: 'Missing $ inserted',
        context: 'l.22 E = mc^2',
        file: 'main.tex',
        severity: 'error',
      },
    ];

    diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');
    const items = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');

    expect(items).toHaveLength(1);
    expect(items[0].suggestion).toContain('math mode');
    expect(items[0].suggestion).toContain('$...$');
    expect(items[0].fixedSnippet).toBeDefined();
  });

  it('automatically enriches "perhaps a missing \\item" with list environment advice', () => {
    const errors: CompileError[] = [
      {
        line: 35,
        message: 'LaTeX Error: Something\'s wrong--perhaps a missing \\item.',
        context: 'l.35 \\begin{itemize}',
        file: 'main.tex',
        severity: 'error',
      },
    ];

    diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');
    const items = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');

    expect(items).toHaveLength(1);
    expect(items[0].suggestion).toContain('\\item');
  });

  it('prevents cross-file diagnostic leakage across multi-file projects', () => {
    const errors: CompileError[] = [
      {
        line: 10,
        message: 'Undefined control sequence \\includegraphics',
        file: 'sections/figures.tex',
        severity: 'error',
      },
      {
        line: 42,
        message: 'Overfull \\hbox (15.2pt too wide)',
        file: 'chapters/intro.tex',
        severity: 'warning',
      },
      {
        line: 5,
        message: 'Missing \\begin{document}',
        file: 'main.tex',
        severity: 'error',
      },
    ];

    diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');

    // Verify main.tex only has its own error
    const mainItems = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');
    expect(mainItems).toHaveLength(1);
    expect(mainItems[0].line).toBe(5);

    // Verify sections/figures.tex only has its own error
    const figureItems = diagnosticsCoordinator.getDiagnosticsForFile('sections/figures.tex');
    expect(figureItems).toHaveLength(1);
    expect(figureItems[0].line).toBe(10);
    expect(figureItems[0].suggestion).toContain('graphicx');

    // Verify chapters/intro.tex only has its own warning
    const introItems = diagnosticsCoordinator.getDiagnosticsForFile('chapters/intro.tex');
    expect(introItems).toHaveLength(1);
    expect(introItems[0].line).toBe(42);
    expect(introItems[0].severity).toBe('warning');

    // Verify project summary aggregates correctly
    const summary = diagnosticsCoordinator.getProjectSummary();
    expect(summary.errorCount).toBe(2);
    expect(summary.warningCount).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('performs O(log K) binary search lookup of diagnostics at a specific line', () => {
    const errors: CompileError[] = [
      { line: 5, message: 'Warning A', severity: 'warning', file: 'main.tex' },
      { line: 12, message: 'Error B', severity: 'error', file: 'main.tex' },
      { line: 12, message: 'Error C on same line', severity: 'error', file: 'main.tex' },
      { line: 25, message: 'Warning D', severity: 'warning', file: 'main.tex' },
    ];

    diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');

    const line12Items = diagnosticsCoordinator.findDiagnosticsAtLine('main.tex', 12);
    expect(line12Items).toHaveLength(2);
    expect(line12Items.map((i) => i.message)).toEqual(['Error B', 'Error C on same line']);

    const line99Items = diagnosticsCoordinator.findDiagnosticsAtLine('main.tex', 99);
    expect(line99Items).toHaveLength(0);
  });
});
