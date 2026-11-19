/**
 * diagnostics-query-index.ts
 *
 * Interval/binary-search diagnostic queries, item normalization & deduplication,
 * shift/summary calculators, and immutable types for DiagnosticsCoordinator.
 */

import type { CompileError } from '@/features/editor/domain/types/compiler.types';
import { fixLatexError } from '@/features/editor/domain/ai/ai-error-assist';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';

export interface IndexedDiagnosticItem extends EditorDiagnosticItem {
  id: string;
  file: string;
  fileKey?: string;
  rawFile?: string;
  normalizedPath: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: 'compiler' | 'static' | 'chktex' | 'bibtex' | 'linter' | string;
  code?: string;
  context?: string;
  suggestion?: string;
  fixedSnippet?: string;
  originalSnippet?: string;
  confidence?: 'high' | 'medium' | 'low' | number;
}

export interface FileDiagnosticsSummary {
  errorCount: number;
  warningCount: number;
  badboxCount?: number;
  infoCount: number;
  total: number;
  totalCount: number;
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
  fileIndex?: Map<string, IndexedDiagnosticItem[]>;
  unmappedDiagnostics?: IndexedDiagnosticItem[];
  projectSummary?: FileDiagnosticsSummary;
  telemetry?: DiagnosticsTelemetry;
}

export type DiagnosticsChangeSource = 'linter' | 'compiler' | 'shift' | 'filter' | 'clear';

export const EMPTY_DIAGNOSTICS_SUMMARY: FileDiagnosticsSummary = Object.freeze({
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  total: 0,
  totalCount: 0,
});

export function areSummariesEqual(
  a: FileDiagnosticsSummary | undefined,
  b: FileDiagnosticsSummary,
): boolean {
  if (!a) return false;
  return (
    a.errorCount === b.errorCount &&
    a.warningCount === b.warningCount &&
    a.infoCount === b.infoCount &&
    a.total === b.total &&
    a.totalCount === b.totalCount
  );
}

export function areDiagnosticsEqual(
  prev: IndexedDiagnosticItem[] | undefined,
  next: IndexedDiagnosticItem[],
): boolean {
  if (!prev) return next.length === 0;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.line !== b.line ||
      a.column !== b.column ||
      a.severity !== b.severity ||
      a.message !== b.message ||
      a.source !== b.source
    ) {
      return false;
    }
  }
  return true;
}

export function buildIndexedCompilerErrorItem(
  err: CompileError,
  index: number,
  canonicalKey: string,
  defaultFile: string,
): IndexedDiagnosticItem {
  const line = err.line!;
  const heuristic = !err.suggestion
    ? fixLatexError({
        errorMessage: err.message,
        errorLine: line,
        errorFile: err.file || defaultFile,
        detail: err.context,
      })
    : null;

  return {
    id: `comp-${index}-${line}`,
    file: err.file || defaultFile,
    normalizedPath: canonicalKey,
    line,
    column: 1,
    message: err.message,
    severity: err.severity === 'warning' ? 'warning' : 'error',
    context: err.context,
    code: err.code,
    suggestion: err.suggestion || heuristic?.explanation,
    fixedSnippet: err.fixedSnippet || heuristic?.fixedSnippet,
    originalSnippet: err.originalSnippet || heuristic?.originalSnippet,
    confidence: heuristic?.confidence,
    source: 'LaTeX Compiler',
  };
}

export function shiftDiagnosticItemsList(
  items: IndexedDiagnosticItem[] | undefined,
  fromLine: number,
  deltaLines: number,
): { shifted: IndexedDiagnosticItem[] | null; changed: boolean } {
  if (!items || items.length === 0) {
    return { shifted: null, changed: false };
  }
  let changed = false;
  const next = items.map((item) => {
    if (item.line >= fromLine) {
      changed = true;
      const newLine = Math.max(1, item.line + deltaLines);
      const newEndLine =
        item.endLine !== undefined ? Math.max(newLine, item.endLine + deltaLines) : undefined;
      return {
        ...item,
        line: newLine,
        ...(newEndLine !== undefined ? { endLine: newEndLine } : {}),
      };
    }
    return item;
  });
  if (changed) {
    next.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
  }
  return { shifted: changed ? next : null, changed };
}

export function mergeCompilerAndLinterItems(
  fileIdOrPath: string,
  canonicalKey: string,
  rawCompilerItems: IndexedDiagnosticItem[],
  linterItems: IndexedDiagnosticItem[],
): IndexedDiagnosticItem[] {
  let compilerItems = rawCompilerItems;

  const isBib = fileIdOrPath.endsWith('.bib') || canonicalKey.endsWith('.bib');
  if (isBib && compilerItems.length > 0) {
    const isLatexDocError = (msg: string) =>
      /missing \\begin\{document\}|documentclass|emergency stop|fatal error occurred|no output pdf/i.test(msg);
    compilerItems = compilerItems.filter(
      (item) => !isLatexDocError(item.message) && (!item.file || item.file.endsWith('.bib')),
    );
  }

  if (linterItems.length === 0) {
    return compilerItems;
  }
  if (compilerItems.length === 0) {
    return linterItems;
  }

  const normalizeMsg = (m: string) =>
    m.toLowerCase().replace(/^(?:!|latex error:|error:|\s)+/g, '').replace(/[\s\r\n]+/g, ' ').trim();
  const seenLineCode = new Set<string>();
  const seenMessages = new Set<string>();
  const combined: IndexedDiagnosticItem[] = [];
  for (const item of compilerItems) {
    const norm = normalizeMsg(item.message);
    seenLineCode.add(`${item.line}:${item.code || norm.slice(0, 40)}`);
    seenMessages.add(norm);
    combined.push(item);
  }
  for (const item of linterItems) {
    const norm = normalizeMsg(item.message);
    const itemKey = `${item.line}:${item.code || norm.slice(0, 40)}`;
    if (!seenLineCode.has(itemKey) && !seenMessages.has(norm)) {
      seenLineCode.add(itemKey);
      seenMessages.add(norm);
      combined.push(item);
    }
  }
  combined.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
  return combined;
}

export function binarySearchDiagnosticsAtLine(
  items: IndexedDiagnosticItem[],
  targetLine: number,
): IndexedDiagnosticItem[] {
  if (items.length === 0 || targetLine < 1) return [];

  let low = 0;
  let high = items.length - 1;
  let matchIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midLine = items[mid].line;
    if (midLine === targetLine) {
      matchIdx = mid;
      break;
    } else if (midLine < targetLine) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (matchIdx === -1) return [];

  let start = matchIdx;
  while (start > 0 && items[start - 1].line === targetLine) {
    start--;
  }

  let end = matchIdx;
  while (end < items.length - 1 && items[end + 1].line === targetLine) {
    end++;
  }

  return items.slice(start, end + 1);
}

export function binarySearchDiagnosticsInRange(
  items: IndexedDiagnosticItem[],
  fromLine: number,
  toLine: number,
): IndexedDiagnosticItem[] {
  if (items.length === 0 || fromLine > toLine) return [];

  let low = 0;
  let high = items.length - 1;
  let startIndex = items.length;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].line >= fromLine) {
      startIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (startIndex >= items.length || items[startIndex].line > toLine) {
    return [];
  }

  low = startIndex;
  high = items.length - 1;
  let endIndex = startIndex;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].line <= toLine) {
      endIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return items.slice(startIndex, endIndex + 1);
}

export function summarizeDiagnosticItems(
  items: IndexedDiagnosticItem[],
): FileDiagnosticsSummary {
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const item of items) {
    if (item.severity === 'error') errorCount++;
    else if (item.severity === 'warning') warningCount++;
    else infoCount++;
  }

  const total = items.length;
  return { errorCount, warningCount, infoCount, total, totalCount: total };
}
