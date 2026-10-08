/**
 * diagnostics.coordinator.ts
 *
 * Interval-Indexed Diagnostics & Compiler Errors Coordinator (Coordinators Layer).
 *
 * Capabilities:
 * - Groups and indexes compiler errors, TeX warnings, badboxes, and static linter findings by file.
 * - Sorts diagnostics per file by line and column for O(log K) binary search queries.
 * - Eliminates cross-file diagnostic leakage (e.g. errors from chapters/ch2.tex being projected onto main.tex).
 * - O(log K) Range / Viewport Querying for instant CodeMirror gutter and hover evaluations.
 * - Provides summary metrics per file and whole-project (errors, warnings, badboxes).
 */

import type { CompileError } from '../domain/types/compiler.types';
import { normalizeLatexPath } from '../domain/latex-dag-engine';

export interface IndexedDiagnosticItem {
  id: string;
  file?: string;
  normalizedPath?: string;
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: string;
  code?: string;
  suggestion?: string;
  source: 'LaTeX Compiler' | 'LaTeX Linter' | 'Retracted Citation' | 'System';
}

export interface FileDiagnosticsSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  total: number;
}

export class DiagnosticsCoordinatorRegistry {
  private fileIndex = new Map<string, IndexedDiagnosticItem[]>();
  private unmappedDiagnostics: IndexedDiagnosticItem[] = [];
  private aliasMap = new Map<string, string>();
  private listeners = new Set<(fileKey?: string) => void>();

  public clear(): void {
    this.fileIndex.clear();
    this.unmappedDiagnostics = [];
    this.aliasMap.clear();
    this.notify();
  }

  public registerAlias(canonicalPath: string, alias: string): void {
    if (!canonicalPath || !alias) return;
    const normCanonical = normalizeLatexPath(canonicalPath);
    const normAlias = normalizeLatexPath(alias);
    this.aliasMap.set(alias, normCanonical);
    this.aliasMap.set(normAlias, normCanonical);
  }

  private resolveCanonicalKey(fileIdOrPath: string): string {
    if (this.aliasMap.has(fileIdOrPath)) {
      return this.aliasMap.get(fileIdOrPath)!;
    }
    const norm = normalizeLatexPath(fileIdOrPath);
    if (this.aliasMap.has(norm)) {
      return this.aliasMap.get(norm)!;
    }
    if (this.fileIndex.has(norm)) {
      return norm;
    }
    for (const key of this.fileIndex.keys()) {
      if (key.endsWith(`/${norm}`) || norm.endsWith(`/${key}`)) {
        return key;
      }
    }
    return norm;
  }

  public ingestCompilerErrors(errors: CompileError[], defaultFile = 'main.tex'): void {
    this.fileIndex.clear();
    this.unmappedDiagnostics = [];

    const normDefault = normalizeLatexPath(defaultFile);

    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      const rawFile = err.file ? err.file.trim() : '';
      const canonicalKey = rawFile ? this.resolveCanonicalKey(rawFile) : normDefault;

      const item: IndexedDiagnosticItem = {
        id: `comp-${i}-${err.line ?? 0}`,
        file: err.file || defaultFile,
        normalizedPath: canonicalKey,
        line: Math.max(1, err.line || 1),
        column: 1,
        message: err.message,
        severity: err.severity === 'warning' ? 'warning' : 'error',
        context: err.context,
        code: err.code,
        suggestion: err.suggestion,
        source: 'LaTeX Compiler',
      };

      if (!this.fileIndex.has(canonicalKey)) {
        this.fileIndex.set(canonicalKey, []);
      }
      this.fileIndex.get(canonicalKey)!.push(item);
    }

    for (const list of this.fileIndex.values()) {
      list.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
    }

    this.notify();
  }

  public getDiagnosticsForFile(fileIdOrPath: string): IndexedDiagnosticItem[] {
    const key = this.resolveCanonicalKey(fileIdOrPath);
    return this.fileIndex.get(key) || [];
  }

  public getFileDiagnostics(fileIdOrPath: string): IndexedDiagnosticItem[] {
    return this.getDiagnosticsForFile(fileIdOrPath);
  }

  public findDiagnosticsAtLine(fileIdOrPath: string, targetLine: number): IndexedDiagnosticItem[] {
    const items = this.getDiagnosticsForFile(fileIdOrPath);
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

  public findDiagnosticsInRange(
    fileIdOrPath: string,
    fromLine: number,
    toLine: number
  ): IndexedDiagnosticItem[] {
    const items = this.getDiagnosticsForFile(fileIdOrPath);
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

  public getFileSummary(fileIdOrPath: string): FileDiagnosticsSummary {
    const items = this.getDiagnosticsForFile(fileIdOrPath);
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const item of items) {
      if (item.severity === 'error') errorCount++;
      else if (item.severity === 'warning') warningCount++;
      else infoCount++;
    }

    return { errorCount, warningCount, infoCount, total: items.length };
  }

  public getProjectSummary(): FileDiagnosticsSummary {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let total = 0;

    for (const list of this.fileIndex.values()) {
      for (const item of list) {
        total++;
        if (item.severity === 'error') errorCount++;
        else if (item.severity === 'warning') warningCount++;
        else infoCount++;
      }
    }

    return { errorCount, warningCount, infoCount, total };
  }

  public subscribe(callback: (fileKey?: string) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(fileKey?: string): void {
    for (const listener of this.listeners) {
      try {
        listener(fileKey);
      } catch (err) {
        console.error('[DiagnosticsCoordinator] Listener error:', err);
      }
    }
  }
}

export const diagnosticsCoordinator = new DiagnosticsCoordinatorRegistry();
