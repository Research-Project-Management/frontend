/**
 * diagnostics-coordinator-deep-module.test.ts
 *
 * Verification suite for DiagnosticsCoordinator as a Deep Module (Matt Pocock design pattern):
 * - Compiler errors ingestion, normalization & heuristic error assist enrichment.
 * - Linter diagnostics indexing & canonical alias mapping.
 * - O(log K) binary search queries (line & range) with telemetry tracking.
 * - File, folder, and project aggregations with cache management.
 * - Telemetry metrics and snapshot generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DiagnosticsCoordinatorRegistry,
  diagnosticsCoordinator,
} from '@/features/editor/subsystems/diagnostics';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';

describe('DiagnosticsCoordinator Deep Module', () => {
  let coordinator: DiagnosticsCoordinatorRegistry;

  beforeEach(() => {
    coordinator = new DiagnosticsCoordinatorRegistry();
  });

  describe('Compiler Errors Ingestion & Canonical Resolution', () => {
    it('ingests and indexes compiler errors by file', () => {
      const errors: CompileError[] = [
        { message: 'Undefined control sequence \\foo', line: 12, file: 'main.tex', severity: 'error' },
        { message: 'Underfull \\hbox', line: 5, file: 'main.tex', severity: 'warning' },
        { message: 'Package hyperref Warning: Token not allowed', line: 30, file: 'chapters/intro.tex', severity: 'warning' },
      ];

      coordinator.ingestCompilerErrors(errors);

      const mainDiags = coordinator.getDiagnosticsForFile('main.tex');
      expect(mainDiags).toHaveLength(2);
      expect(mainDiags[0].line).toBe(5); // sorted by line
      expect(mainDiags[1].line).toBe(12);

      const introDiags = coordinator.getDiagnosticsForFile('chapters/intro.tex');
      expect(introDiags).toHaveLength(1);
      expect(introDiags[0].line).toBe(30);
    });

    it('resolves aliases when files are moved or referenced relatively', () => {
      coordinator.registerAlias('src/sections/ch1.tex', 'ch1.tex');

      const errors: CompileError[] = [
        { message: 'Missing $ inserted', line: 15, file: 'ch1.tex', severity: 'error' },
      ];
      coordinator.ingestCompilerErrors(errors);

      const resolved = coordinator.getDiagnosticsForFile('src/sections/ch1.tex');
      expect(resolved).toHaveLength(1);
      expect(resolved[0].message).toContain('Missing $ inserted');
    });
  });

  describe('Linter Diagnostics & Merging', () => {
    it('merges linter diagnostics with compiler errors and deduplicates keys', () => {
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

      const diags = coordinator.getDiagnosticsForFile('main.tex');
      expect(diags).toHaveLength(2);
      expect(diags[0].line).toBe(10);
      expect(diags[1].line).toBe(25);
    });

    it('clears linter diagnostics for specific file and globally', () => {
      coordinator.ingestLinterDiagnostics('main.tex', [
        { id: 'l1', file: 'main.tex', line: 1, message: 'W1', severity: 'warning', source: 'LaTeX Linter' },
      ]);
      coordinator.ingestLinterDiagnostics('other.tex', [
        { id: 'l2', file: 'other.tex', line: 2, message: 'W2', severity: 'warning', source: 'LaTeX Linter' },
      ]);

      coordinator.clearLinterDiagnostics('main.tex');
      expect(coordinator.getDiagnosticsForFile('main.tex')).toHaveLength(0);
      expect(coordinator.getDiagnosticsForFile('other.tex')).toHaveLength(1);

      coordinator.clearLinterDiagnostics();
      expect(coordinator.getDiagnosticsForFile('other.tex')).toHaveLength(0);
    });
  });

  describe('O(log K) Binary Search Range & Line Queries', () => {
    beforeEach(() => {
      const errors: CompileError[] = [
        { message: 'Err on 5', line: 5, file: 'main.tex', severity: 'error' },
        { message: 'Err on 10', line: 10, file: 'main.tex', severity: 'error' },
        { message: 'Another on 10', line: 10, file: 'main.tex', severity: 'warning' },
        { message: 'Err on 20', line: 20, file: 'main.tex', severity: 'error' },
        { message: 'Err on 35', line: 35, file: 'main.tex', severity: 'error' },
      ];
      coordinator.ingestCompilerErrors(errors);
    });

    it('findDiagnosticsAtLine returns all matching diagnostics at exact line', () => {
      const atLine10 = coordinator.findDiagnosticsAtLine('main.tex', 10);
      expect(atLine10).toHaveLength(2);

      const atLine15 = coordinator.findDiagnosticsAtLine('main.tex', 15);
      expect(atLine15).toHaveLength(0);
    });

    it('findDiagnosticsInRange finds all diagnostics in [fromLine, toLine]', () => {
      const inRange = coordinator.findDiagnosticsInRange('main.tex', 8, 25);
      expect(inRange).toHaveLength(3);
      expect(inRange.map((d) => d.line)).toEqual([10, 10, 20]);
    });
  });

  describe('Summaries & Cache Invalidation', () => {
    it('computes file, folder, and project summaries correctly', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Err 1', line: 1, file: 'chapters/ch1.tex', severity: 'error' },
        { message: 'Warn 1', line: 2, file: 'chapters/ch1.tex', severity: 'warning' },
        { message: 'Err 2', line: 1, file: 'chapters/ch2.tex', severity: 'error' },
        { message: 'Warn 2', line: 1, file: 'main.tex', severity: 'warning' },
      ]);

      const ch1Summary = coordinator.getFileSummary('chapters/ch1.tex');
      expect(ch1Summary).toEqual({ errorCount: 1, warningCount: 1, infoCount: 0, total: 2 });

      const folderSummary = coordinator.getFolderSummary('chapters');
      expect(folderSummary).toEqual({ errorCount: 2, warningCount: 1, infoCount: 0, total: 3 });

      const projectSummary = coordinator.getProjectSummary();
      expect(projectSummary).toEqual({ errorCount: 2, warningCount: 2, infoCount: 0, total: 4 });
    });
  });

  describe('Telemetry & Snapshot Ports', () => {
    it('tracks ingestion, queries, and cache hits in telemetry metrics', () => {
      coordinator.resetTelemetry();

      coordinator.ingestCompilerErrors([
        { message: 'E1', line: 5, file: 'main.tex', severity: 'error' },
        { message: 'E2', line: 10, file: 'main.tex', severity: 'error' },
      ]);

      coordinator.ingestLinterDiagnostics('main.tex', [
        { id: 'l1', file: 'main.tex', line: 7, message: 'W1', severity: 'warning', source: 'LaTeX Linter' },
      ]);

      coordinator.findDiagnosticsAtLine('main.tex', 5);
      coordinator.findDiagnosticsInRange('main.tex', 1, 20);

      // Cache hit test
      coordinator.getFileSummary('main.tex');
      coordinator.getFileSummary('main.tex'); // second call is cache hit

      const telemetry = coordinator.getTelemetry();
      expect(telemetry.totalIngested).toBe(2);
      expect(telemetry.linterIngested).toBe(1);
      expect(telemetry.binarySearchQueries).toBe(2);
      expect(telemetry.queryHits).toBe(2);
      expect(telemetry.cacheHits).toBe(1);
    });

    it('generates a complete snapshot of diagnostics state', () => {
      coordinator.ingestCompilerErrors([
        { message: 'E1', line: 1, file: 'doc.tex', severity: 'error' },
      ]);

      const snapshot = coordinator.getSnapshot();
      expect(snapshot.fileCount).toBe(1);
      expect(snapshot.totalDiagnostics).toBe(1);
      expect(snapshot.summary.errorCount).toBe(1);
    });
  });

  describe('shiftDiagnostics line delta shifts', () => {
    it('shifts lines for diagnostics at or below fromLine on line insertion (Enter)', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Error at line 5', line: 5, file: 'main.tex', severity: 'error' },
        { message: 'Error at line 20', line: 20, file: 'main.tex', severity: 'error' },
      ]);
      coordinator.ingestLinterDiagnostics('main.tex', [
        { id: 'l1', file: 'main.tex', line: 3, message: 'Warning at line 3', severity: 'warning', source: 'LaTeX Linter' },
        { id: 'l2', file: 'main.tex', line: 15, message: 'Warning at line 15', severity: 'warning', source: 'LaTeX Linter' },
      ]);

      // User presses Enter at line 10, adding 2 lines
      coordinator.shiftDiagnostics('main.tex', 10, 2);

      const diags = coordinator.getDiagnosticsForFile('main.tex');
      const byMsg = Object.fromEntries(diags.map((d) => [d.message, d.line]));
      expect(byMsg['Warning at line 3']).toBe(3); // untouched (< 10)
      expect(byMsg['Error at line 5']).toBe(5); // untouched (< 10)
      expect(byMsg['Warning at line 15']).toBe(17); // shifted +2
      expect(byMsg['Error at line 20']).toBe(22); // shifted +2
    });

    it('shifts lines backwards on line deletion (Backspace)', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Error at line 10', line: 10, file: 'main.tex', severity: 'error' },
      ]);

      // Delete 3 lines starting at line 6
      coordinator.shiftDiagnostics('main.tex', 6, -3);

      const diags = coordinator.getDiagnosticsForFile('main.tex');
      expect(diags[0].line).toBe(7); // 10 - 3 = 7
    });

    it('does nothing when deltaLines is 0 or file is empty', () => {
      coordinator.ingestCompilerErrors([
        { message: 'Error at line 10', line: 10, file: 'main.tex', severity: 'error' },
      ]);
      coordinator.shiftDiagnostics('main.tex', 5, 0);
      coordinator.shiftDiagnostics('', 5, 2);
      expect(coordinator.getDiagnosticsForFile('main.tex')[0].line).toBe(10);
    });
  });
});
