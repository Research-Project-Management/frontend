/**
 * diagnostics-port.ts
 *
 * Pure Domain Port interfaces for Diagnostics management.
 * Location: `features/editor/domain/diagnostics/diagnostics-port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Pure Domain contract for diagnostics indexing, querying, and telemetry.
 * - Decoupled from UI hooks and React components.
 */

import type { EditorDiagnosticItem } from '@/features/editor/core/bus/command-bus.port';

export type IndexedDiagnosticItem = EditorDiagnosticItem;

export interface FileDiagnosticsSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  total: number;
}

export interface DiagnosticsTelemetry {
  totalIngested: number;
  linterIngested: number;
  binarySearchQueries: number;
  queryHits: number;
  cacheHits: number;
}

export interface DiagnosticsSnapshot {
  fileCount: number;
  totalDiagnostics: number;
  summary: FileDiagnosticsSummary;
}

export interface IDiagnosticsCoordinator {
  clear(): void;
  ingestCompilerErrors(errors: unknown[], defaultFile?: string): void;
  ingestLinterDiagnostics(fileIdOrPath: string, diagnostics: IndexedDiagnosticItem[]): void;
  clearLinterDiagnostics(fileIdOrPath?: string): void;
  shiftDiagnostics(fileIdOrPath: string, fromLine: number, deltaLines: number): void;
  getDiagnosticsForFile(fileIdOrPath: string, applyFilter?: boolean): IndexedDiagnosticItem[];
  findDiagnosticsAtLine(fileIdOrPath: string, targetLine: number): IndexedDiagnosticItem[];
  findDiagnosticsInRange(fileIdOrPath: string, fromLine: number, toLine: number): IndexedDiagnosticItem[];
  getFileSummary(fileIdOrPath: string, applyFilter?: boolean): FileDiagnosticsSummary;
  getFolderSummary(folderNameOrPath: string, applyFilter?: boolean): FileDiagnosticsSummary;
  getProjectSummary(applyFilter?: boolean): FileDiagnosticsSummary;
  getAllDiagnostics(applyFilter?: boolean): IndexedDiagnosticItem[];
  getDiagnosticsCount(severity?: 'error' | 'warning' | 'info', applyFilter?: boolean): number;
  subscribe(callback: (fileKey?: string) => void): () => void;
  getTelemetry(): DiagnosticsTelemetry;
  getSnapshot(): DiagnosticsSnapshot;
}
