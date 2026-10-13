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
import { normalizeLatexPath } from '../domain/latex/latex-dag-engine';
import { heuristicLatexErrorFix } from '../domain/ai/ai-error-assist';
import type { EditorDiagnosticItem } from '../domain/types/ports/command-bus.port';
import { type WarningFilterOptions, filterDiagnostics } from '../domain/compiler/warning-filter';
import { useState, useEffect } from 'react';

export type IndexedDiagnosticItem = EditorDiagnosticItem;

export interface FileDiagnosticsSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  total: number;
}

export class DiagnosticsCoordinatorRegistry {
  private fileIndex = new Map<string, IndexedDiagnosticItem[]>();
  private linterIndex = new Map<string, IndexedDiagnosticItem[]>();
  private unmappedDiagnostics: IndexedDiagnosticItem[] = [];
  private aliasMap = new Map<string, string>();
  private filterOptions: WarningFilterOptions = {};
  private listeners = new Set<(fileKey?: string) => void>();

  public clear(): void {
    this.fileIndex.clear();
    this.linterIndex.clear();
    this.unmappedDiagnostics = [];
    this.aliasMap.clear();
    this.notify();
  }

  public setFilterOptions(options: WarningFilterOptions): void {
    this.filterOptions = { ...options };
    this.notify();
  }

  public getFilterOptions(): WarningFilterOptions {
    return { ...this.filterOptions };
  }

  public ingestLinterDiagnostics(fileIdOrPath: string, diagnostics: IndexedDiagnosticItem[]): void {
    if (!fileIdOrPath) return;
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
    this.linterIndex.set(canonicalKey, [...diagnostics]);
    this.notify(canonicalKey);
  }

  public clearLinterDiagnostics(fileIdOrPath?: string): void {
    if (fileIdOrPath) {
      const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
      this.linterIndex.delete(canonicalKey);
      this.notify(canonicalKey);
    } else {
      this.linterIndex.clear();
      this.notify();
    }
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

      const heuristic = !err.suggestion
        ? heuristicLatexErrorFix({
            errorMessage: err.message,
            errorLine: err.line ?? 1,
            errorFile: err.file || defaultFile,
            detail: err.context,
          })
        : null;

      const suggestion = err.suggestion || heuristic?.explanation;
      const fixedSnippet = err.fixedSnippet || heuristic?.fixedSnippet;
      const originalSnippet = err.originalSnippet || heuristic?.originalSnippet;
      const confidence = heuristic?.confidence;

      // In-place enrichment for store consumers
      err.suggestion = suggestion;
      err.fixedSnippet = fixedSnippet;
      err.originalSnippet = originalSnippet;

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
        suggestion,
        fixedSnippet,
        originalSnippet,
        confidence,
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

  public getDiagnosticsForFile(fileIdOrPath: string, applyFilter = true): IndexedDiagnosticItem[] {
    const key = this.resolveCanonicalKey(fileIdOrPath);
    const compilerItems = this.fileIndex.get(key) || [];
    const linterItems = this.linterIndex.get(key) || [];

    let combined: IndexedDiagnosticItem[];
    if (linterItems.length === 0) {
      combined = compilerItems;
    } else if (compilerItems.length === 0) {
      combined = linterItems;
    } else {
      const seen = new Set<string>();
      combined = [];
      for (const item of compilerItems) {
        seen.add(`${item.line}:${item.code || item.message.slice(0, 30)}`);
        combined.push(item);
      }
      for (const item of linterItems) {
        const itemKey = `${item.line}:${item.code || item.message.slice(0, 30)}`;
        if (!seen.has(itemKey)) {
          combined.push(item);
        }
      }
      combined.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
    }

    if (applyFilter) {
      return filterDiagnostics(combined, this.filterOptions);
    }
    return combined;
  }

  public getFileDiagnostics(fileIdOrPath: string, applyFilter = true): IndexedDiagnosticItem[] {
    return this.getDiagnosticsForFile(fileIdOrPath, applyFilter);
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

  public getFileSummary(fileIdOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    const items = this.getDiagnosticsForFile(fileIdOrPath, applyFilter);
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

  public getFolderSummary(folderNameOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    const rawFolder = folderNameOrPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rawFolder) return this.getProjectSummary(applyFilter);

    const prefix = `${rawFolder}/`;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let total = 0;

    const checkedKeys = new Set<string>();
    const allKeys = new Set([...this.fileIndex.keys(), ...this.linterIndex.keys()]);

    for (const key of allKeys) {
      if (key.startsWith(prefix) || key.includes(`/${prefix}`) || key === rawFolder) {
        if (!checkedKeys.has(key)) {
          checkedKeys.add(key);
          const fileSummary = this.getFileSummary(key, applyFilter);
          errorCount += fileSummary.errorCount;
          warningCount += fileSummary.warningCount;
          infoCount += fileSummary.infoCount;
          total += fileSummary.total;
        }
      }
    }

    return { errorCount, warningCount, infoCount, total };
  }

  public getProjectSummary(applyFilter = true): FileDiagnosticsSummary {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let total = 0;

    const allKeys = new Set([...this.fileIndex.keys(), ...this.linterIndex.keys()]);
    for (const key of allKeys) {
      const summary = this.getFileSummary(key, applyFilter);
      errorCount += summary.errorCount;
      warningCount += summary.warningCount;
      infoCount += summary.infoCount;
      total += summary.total;
    }

    return { errorCount, warningCount, infoCount, total };
  }

  public getAllDiagnostics(applyFilter = true): IndexedDiagnosticItem[] {
    const allKeys = new Set([...this.fileIndex.keys(), ...this.linterIndex.keys()]);
    const all: IndexedDiagnosticItem[] = [];

    for (const key of allKeys) {
      all.push(...this.getDiagnosticsForFile(key, applyFilter));
    }
    for (const unmapped of this.unmappedDiagnostics) {
      if (!applyFilter || filterDiagnostics([unmapped], this.filterOptions).length > 0) {
        all.push(unmapped);
      }
    }

    return all.sort((a, b) => {
      const fileA = a.file || a.normalizedPath || '';
      const fileB = b.file || b.normalizedPath || '';
      const fileCompare = fileA.localeCompare(fileB);
      if (fileCompare !== 0) return fileCompare;
      return a.line - b.line || (a.column ?? 0) - (b.column ?? 0);
    });
  }

  public getDiagnosticsCount(severity?: 'error' | 'warning' | 'info', applyFilter = true): number {
    const all = this.getAllDiagnostics(applyFilter);
    if (!severity) return all.length;
    return all.filter((d) => d.severity === severity).length;
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

/**
 * React Hook for subscribing to a single file's diagnostics summary in the UI.
 */
export function useFileDiagnosticsSummary(fileIdOrPath: string, applyFilter = true): FileDiagnosticsSummary {
  const [summary, setSummary] = useState<FileDiagnosticsSummary>(() =>
    diagnosticsCoordinator.getFileSummary(fileIdOrPath, applyFilter)
  );

  useEffect(() => {
    const update = () => {
      setSummary(diagnosticsCoordinator.getFileSummary(fileIdOrPath, applyFilter));
    };
    update();
    return diagnosticsCoordinator.subscribe(update);
  }, [fileIdOrPath, applyFilter]);

  return summary;
}

/**
 * React Hook for subscribing to a folder's aggregated diagnostics summary in the UI.
 */
export function useFolderDiagnosticsSummary(folderNameOrPath: string, applyFilter = true): FileDiagnosticsSummary {
  const [summary, setSummary] = useState<FileDiagnosticsSummary>(() =>
    diagnosticsCoordinator.getFolderSummary(folderNameOrPath, applyFilter)
  );

  useEffect(() => {
    const update = () => {
      setSummary(diagnosticsCoordinator.getFolderSummary(folderNameOrPath, applyFilter));
    };
    update();
    return diagnosticsCoordinator.subscribe(update);
  }, [folderNameOrPath, applyFilter]);

  return summary;
}

/**
 * React Hook for subscribing to the whole project's diagnostics summary in the UI.
 */
export function useProjectDiagnosticsSummary(applyFilter = true): FileDiagnosticsSummary {
  const [summary, setSummary] = useState<FileDiagnosticsSummary>(() =>
    diagnosticsCoordinator.getProjectSummary(applyFilter)
  );

  useEffect(() => {
    const update = () => {
      setSummary(diagnosticsCoordinator.getProjectSummary(applyFilter));
    };
    update();
    return diagnosticsCoordinator.subscribe(update);
  }, [applyFilter]);

  return summary;
}

