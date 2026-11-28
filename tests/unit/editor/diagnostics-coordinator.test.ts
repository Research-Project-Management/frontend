import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DiagnosticsCoordinator,
  diagnosticsCoordinator,
} from '@/features/editor/subsystems/diagnostics';
import {
  shouldSuppressWarning,
  filterDiagnostics,
  type WarningFilterOptions,
} from '@/features/editor/domain/latex/warning-filter';
import { useSettingsStore } from '@/features/editor/core';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';

describe('DiagnosticsCoordinator, Quick-Fix Enrichment & Warning Suppression', () => {
  let coordinator: DiagnosticsCoordinator;

  beforeEach(() => {
    coordinator = new DiagnosticsCoordinator();
    diagnosticsCoordinator.clear();
    diagnosticsCoordinator.setFilterOptions({});
    useSettingsStore.setState({
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],
    });
  });

  afterEach(() => {
    diagnosticsCoordinator.clear();
    diagnosticsCoordinator.setFilterOptions({});
  });

  describe('1. Ingestion, Alias Resolution & Multi-File Isolation', () => {
    it('ingests compiler errors sorted by line, resolves aliases, and isolates .bib files from LaTeX errors', () => {
      coordinator.registerAlias('src/sections/ch1.tex', 'ch1.tex');
      coordinator.ingestCompilerErrors([
        { message: 'Undefined control sequence \\foo', line: 12, file: 'main.tex', severity: 'error' },
        { message: 'Underfull \\hbox', line: 5, file: 'main.tex', severity: 'warning' },
        { message: 'Missing $ inserted', line: 15, file: 'ch1.tex', severity: 'error' },
      ]);
      coordinator.registerAlias('references.bib', 'doc-bib-uuid');

      const mainDiags = coordinator.getDiagnosticsForFile('main.tex');
      expect(mainDiags.map((d) => d.line)).toEqual([5, 12]);

      const aliased = coordinator.getDiagnosticsForFile('src/sections/ch1.tex');
      expect(aliased).toHaveLength(1);
      expect(aliased[0]?.message).toContain('Missing $ inserted');

      expect(coordinator.getDiagnosticsForFile('references.bib')).toHaveLength(0);
    });

    it('merges linter diagnostics with compiler errors, deduplicates keys, and clears selectively', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Syntax error', line: 10, file: 'main.tex', severity: 'error' },
      ]);
      coordinator.ingestLinterDiagnostics('main.tex', [
        {
          id: 'lint-1',
          file: 'main.tex',
          line: 10,
          column: 1,
          message: 'Syntax error',
          severity: 'error',
          source: 'LaTeX Linter',
        },
        {
          id: 'lint-2',
          file: 'main.tex',
          line: 25,
          column: 1,
          message: 'Unused label',
          severity: 'warning',
          source: 'LaTeX Linter',
        },
      ]);
      coordinator.ingestLinterDiagnostics('other.tex', [
        {
          id: 'lint-3',
          file: 'other.tex',
          line: 2,
          message: 'W2',
          severity: 'warning',
          source: 'LaTeX Linter',
        },
      ]);

      expect(coordinator.getDiagnosticsForFile('main.tex').map((d) => d.line)).toEqual([10, 25]);

      coordinator.clearLinterDiagnostics('main.tex');
      expect(coordinator.getDiagnosticsForFile('main.tex').map((d) => d.line)).toEqual([10]);
      expect(coordinator.getDiagnosticsForFile('other.tex')).toHaveLength(1);

      coordinator.clearLinterDiagnostics();
      expect(coordinator.getDiagnosticsForFile('other.tex')).toHaveLength(0);
    });
  });

  describe('2. O(log K) Binary Search, Line Delta Shifts & Path Lifecycle', () => {
    it('supports O(log K) exact-line and range queries plus telemetry and snapshots', () => {
      coordinator.resetTelemetry();
      coordinator.ingestCompilerErrors([
        { message: 'Err on 5', line: 5, file: 'main.tex', severity: 'error' },
        { message: 'Err on 10', line: 10, file: 'main.tex', severity: 'error' },
        { message: 'Another on 10', line: 10, file: 'main.tex', severity: 'warning' },
        { message: 'Err on 20', line: 20, file: 'main.tex', severity: 'error' },
        { message: 'Err on 35', line: 35, file: 'main.tex', severity: 'error' },
      ]);

      expect(coordinator.findDiagnosticsAtLine('main.tex', 10)).toHaveLength(2);
      expect(coordinator.findDiagnosticsAtLine('main.tex', 15)).toHaveLength(0);
      expect(coordinator.findDiagnosticsInRange('main.tex', 8, 25).map((d) => d.line)).toEqual([
        10, 10, 20,
      ]);

      coordinator.getFileSummary('main.tex');
      coordinator.getFileSummary('main.tex');

      const telemetry = coordinator.getTelemetry();
      expect(telemetry.totalIngested).toBe(5);
      expect(telemetry.binarySearchQueries).toBe(3);
      expect(telemetry.cacheHits).toBe(1);
      expect(coordinator.getSnapshot()).toMatchObject({
        fileCount: 1,
        totalDiagnostics: 5,
      });
    });

    it('shifts diagnostics forward/backward on line edits and ignores zero-delta edits', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Error at line 5', line: 5, file: 'main.tex', severity: 'error' },
        { message: 'Error at line 20', line: 20, file: 'main.tex', severity: 'error' },
      ]);
      coordinator.ingestLinterDiagnostics('main.tex', [
        {
          id: 'l1',
          file: 'main.tex',
          line: 3,
          message: 'Warning at line 3',
          severity: 'warning',
          source: 'LaTeX Linter',
        },
        {
          id: 'l2',
          file: 'main.tex',
          line: 15,
          message: 'Warning at line 15',
          severity: 'warning',
          source: 'LaTeX Linter',
        },
      ]);

      coordinator.shiftDiagnostics('main.tex', 10, 2);
      coordinator.shiftDiagnostics('main.tex', 5, 0);
      coordinator.shiftDiagnostics('', 5, 2);

      const byMsg = Object.fromEntries(
        coordinator.getDiagnosticsForFile('main.tex').map((d) => [d.message, d.line]),
      );
      expect(byMsg).toEqual({
        'Warning at line 3': 3,
        'Error at line 5': 5,
        'Warning at line 15': 17,
        'Error at line 20': 22,
      });

      coordinator.shiftDiagnostics('main.tex', 16, -3);
      expect(
        coordinator.getDiagnosticsForFile('main.tex').find((d) => d.message === 'Warning at line 15')
          ?.line,
      ).toBe(14);
    });

    it('aggregates nested folders without top-level leaf leakage and migrates/purges on renamePath & removePath', () => {
      diagnosticsCoordinator.ingestCompilerErrors(
        [
          {
            line: 14,
            message: 'Missing closing brace',
            file: 'chapters/part3/figures/plot.tex',
            severity: 'error',
          },
          { line: 8, message: 'Error in intro', file: 'sections/intro.tex', severity: 'error' },
          { line: 12, message: 'Warning in body', file: 'sections/body.tex', severity: 'warning' },
        ],
        'main.tex',
      );
      diagnosticsCoordinator.ingestLinterDiagnostics('sections/intro.tex', [
        {
          id: 'lint-intro-1',
          file: 'sections/intro.tex',
          normalizedPath: 'sections/intro.tex',
          line: 20,
          message: 'Lint hint',
          severity: 'warning',
          source: 'LaTeX Linter',
        },
      ]);

      expect(diagnosticsCoordinator.getFolderSummary('figures').total).toBe(0);
      expect(diagnosticsCoordinator.getFolderSummary('chapters/part3/figures').errorCount).toBe(1);
      expect(diagnosticsCoordinator.getFolderSummary('chapters').errorCount).toBe(1);

      diagnosticsCoordinator.renamePath('sections', 'renamed-sections');
      expect(diagnosticsCoordinator.getFolderSummary('sections').total).toBe(0);
      expect(diagnosticsCoordinator.getFolderSummary('renamed-sections')).toMatchObject({
        errorCount: 1,
        warningCount: 2,
      });

      diagnosticsCoordinator.removePath('renamed-sections/intro.tex');
      expect(diagnosticsCoordinator.getFileSummary('renamed-sections/intro.tex').total).toBe(0);
      expect(diagnosticsCoordinator.getFolderSummary('renamed-sections').warningCount).toBe(1);

      diagnosticsCoordinator.removePath('renamed-sections');
      expect(diagnosticsCoordinator.getFolderSummary('renamed-sections').total).toBe(0);
    });
  });

  describe('3. Compiler Quick-Fix Enrichment & Warning Suppression Filter', () => {
    it('enriches \\toprule, missing $, missing \\item, and \\includegraphics errors with quick-fix metadata', () => {
      const errors: CompileError[] = [
        {
          line: 14,
          message: 'Undefined control sequence. \\toprule',
          context: 'l.14 \\toprule',
          file: 'main.tex',
          severity: 'error',
        },
        {
          line: 22,
          message: 'Missing $ inserted',
          context: 'l.22 E = mc^2',
          file: 'main.tex',
          severity: 'error',
        },
        {
          line: 35,
          message: "LaTeX Error: Something's wrong--perhaps a missing \\item.",
          context: 'l.35 \\begin{itemize}',
          file: 'main.tex',
          severity: 'error',
        },
        {
          line: 10,
          message: 'Undefined control sequence \\includegraphics',
          file: 'sections/figures.tex',
          severity: 'error',
        },
      ];

      diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');
      const mainItems = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');
      expect(mainItems[0]?.suggestion).toContain('\\usepackage{booktabs}');
      expect(mainItems[0]?.confidence).toBe('high');
      expect(mainItems[1]?.suggestion).toContain('$...$');
      expect(mainItems[2]?.suggestion).toContain('\\item');

      const figItems = diagnosticsCoordinator.getDiagnosticsForFile('sections/figures.tex');
      expect(figItems[0]?.suggestion).toContain('graphicx');
    });

    it('filters bad boxes, font, package, substring, and /regex/flags warnings without ever suppressing errors', () => {
      const errorItem = {
        message: 'Overfull \\hbox (15.4pt too wide)',
        severity: 'error' as const,
      };
      const allOptions: WarningFilterOptions = {
        suppressBadBoxes: true,
        suppressFontWarnings: true,
        suppressPackageWarnings: true,
        customPatterns: ['Overfull'],
      };
      expect(shouldSuppressWarning(errorItem, allOptions)).toBe(false);
      expect(filterDiagnostics([errorItem], allOptions)).toEqual([errorItem]);

      const warnings = [
        { message: 'Overfull \\hbox (12.3pt too wide)', severity: 'warning' },
        { message: "LaTeX Font Warning: Font shape `TU/ptm/m/n' undefined", severity: 'warning' },
        { message: 'Package hyperref Warning: Token not allowed', severity: 'warning' },
        { message: 'Citation `smith2024` on page 1 undefined', severity: 'warning' },
        { message: 'Float too large for page by 42.0pt', severity: 'warning' },
        { message: 'Keep this warning', severity: 'warning' },
      ];

      expect(filterDiagnostics(warnings, {})).toBe(warnings);
      expect(
        filterDiagnostics(warnings, {
          suppressBadBoxes: true,
          suppressFontWarnings: true,
          suppressPackageWarnings: true,
          customPatterns: ['Citation', '/float too large/i'],
        }),
      ).toEqual([{ message: 'Keep this warning', severity: 'warning' }]);

      // Real-time Zustand settings store -> diagnosticsCoordinator sync
      diagnosticsCoordinator.ingestCompilerErrors(
        [{ line: 15, message: 'Underfull \\hbox (badness 5000)', file: 'main.tex', severity: 'warning' }],
        'main.tex',
      );
      expect(diagnosticsCoordinator.getFileSummary('main.tex').warningCount).toBe(1);

      useSettingsStore.getState().setSuppressBadBoxes(true);
      expect(diagnosticsCoordinator.getFileSummary('main.tex').warningCount).toBe(0);

      useSettingsStore.getState().setSuppressBadBoxes(false);
      expect(diagnosticsCoordinator.getFileSummary('main.tex').warningCount).toBe(1);
    });
  });
});
