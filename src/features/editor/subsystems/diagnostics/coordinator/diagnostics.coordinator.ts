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

import type { CompileError } from '@/features/editor/domain/types/compiler.types';
import { normalizeLatexPath } from '@/features/editor/domain/latex/latex-dag-engine';
import { heuristicLatexErrorFix } from '@/features/editor/domain/ai/ai-error-assist';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';
import { type WarningFilterOptions, filterDiagnostics } from '@/features/editor/domain/latex/warning-filter';
import { useSettingsStore, type DocumentSettingsState } from '@/features/editor/core/store/settings.store';

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

function areSummariesEqual(a: FileDiagnosticsSummary | undefined, b: FileDiagnosticsSummary): boolean {
  if (!a) return false;
  return (
    a.errorCount === b.errorCount &&
    a.warningCount === b.warningCount &&
    a.infoCount === b.infoCount &&
    a.total === b.total &&
    a.totalCount === b.totalCount
  );
}

export class DiagnosticsCoordinatorRegistry {
  private static readonly MAX_ALIAS_MAP_SIZE = 500;
  private fileIndex = new Map<string, IndexedDiagnosticItem[]>();
  private linterIndex = new Map<string, IndexedDiagnosticItem[]>();
  private unmappedDiagnostics: IndexedDiagnosticItem[] = [];
  private aliasMap = new Map<string, string>();
  private filterOptions: WarningFilterOptions = {};
  private listeners = new Set<(fileKey?: string, source?: DiagnosticsChangeSource) => void>();
  private combinedFileIndexCache = new Map<string, IndexedDiagnosticItem[]>();
  private fileSummaryCache = new Map<string, FileDiagnosticsSummary>();
  private prevFileSummaryCache = new Map<string, FileDiagnosticsSummary>();
  private folderSummaryCache = new Map<string, FileDiagnosticsSummary>();
  private prevFolderSummaryCache = new Map<string, FileDiagnosticsSummary>();
  private projectSummaryCache = new Map<boolean, FileDiagnosticsSummary>();
  private prevProjectSummaryCache = new Map<boolean, FileDiagnosticsSummary>();
  private telemetry: DiagnosticsTelemetry = {
    totalIngested: 0,
    linterIngested: 0,
    binarySearchQueries: 0,
    queryHits: 0,
    cacheHits: 0,
  };

  public clear(): void {
    const wasEmpty =
      this.fileIndex.size === 0 &&
      this.linterIndex.size === 0 &&
      this.unmappedDiagnostics.length === 0;
    this.fileIndex.clear();
    this.linterIndex.clear();
    this.unmappedDiagnostics = [];
    this.aliasMap.clear();
    if (!wasEmpty) {
      this.notify(undefined, 'clear');
    }
  }

  public clearDiagnostics(): void {
    this.clear();
  }

  public setFilterOptions(options: WarningFilterOptions & { enableLinter?: boolean; enableSpellcheck?: boolean }): void {
    const prev = this.filterOptions as WarningFilterOptions & { enableLinter?: boolean; enableSpellcheck?: boolean };
    const prevPatterns = prev.customPatterns ?? [];
    const nextPatterns = options.customPatterns ?? [];
    const samePatterns =
      prevPatterns.length === nextPatterns.length &&
      prevPatterns.every((p, idx) => p === nextPatterns[idx]);
    const sameWarningFilters =
      prev.suppressBadBoxes === options.suppressBadBoxes &&
      prev.suppressFontWarnings === options.suppressFontWarnings &&
      prev.suppressPackageWarnings === options.suppressPackageWarnings &&
      samePatterns;
    const sameLinterAndSpellcheck =
      (options.enableLinter === undefined || options.enableLinter === prev.enableLinter) &&
      (options.enableSpellcheck === undefined || options.enableSpellcheck === prev.enableSpellcheck);

    if (sameWarningFilters && sameLinterAndSpellcheck) {
      return;
    }

    this.filterOptions = { ...this.filterOptions, ...options };
    this.notify(undefined, 'filter');
  }

  public getFilterOptions(): WarningFilterOptions {
    return { ...this.filterOptions };
  }

  private areDiagnosticsEqual(
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

  public ingestLinterDiagnostics(fileIdOrPath: string, diagnostics: IndexedDiagnosticItem[]): void {
    if (!fileIdOrPath) return;
    this.telemetry.linterIngested += diagnostics.length;
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
    const prev = this.linterIndex.get(canonicalKey);
    if (this.areDiagnosticsEqual(prev, diagnostics)) {
      return;
    }
    this.linterIndex.set(canonicalKey, [...diagnostics]);
    this.notify(canonicalKey, 'linter');
  }

  public clearLinterDiagnostics(fileIdOrPath?: string): void {
    if (fileIdOrPath) {
      const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
      this.linterIndex.delete(canonicalKey);
      this.notify(canonicalKey, 'linter');
    } else {
      this.linterIndex.clear();
      this.notify(undefined, 'linter');
    }
  }

  /**
   * Optimistically shifts diagnostic line numbers when editing lines (Enter / Backspace),
   * providing zero-latency line tracking before asynchronous background linter re-runs.
   */
  public shiftDiagnostics(fileIdOrPath: string, fromLine: number, deltaLines: number): void {
    if (!fileIdOrPath || deltaLines === 0) return;
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);

    let changed = false;
    const compItems = this.fileIndex.get(canonicalKey);
    if (compItems && compItems.length > 0) {
      let compChanged = false;
      const nextComp = compItems.map((item) => {
        if (item.line >= fromLine) {
          compChanged = true;
          changed = true;
          const newLine = Math.max(1, item.line + deltaLines);
          const newEndLine = item.endLine !== undefined ? Math.max(newLine, item.endLine + deltaLines) : undefined;
          return {
            ...item,
            line: newLine,
            ...(newEndLine !== undefined ? { endLine: newEndLine } : {}),
          };
        }
        return item;
      });
      if (compChanged) {
        nextComp.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
        this.fileIndex.set(canonicalKey, nextComp);
      }
    }

    const linterItems = this.linterIndex.get(canonicalKey);
    if (linterItems && linterItems.length > 0) {
      let linterChanged = false;
      const nextLinter = linterItems.map((item) => {
        if (item.line >= fromLine) {
          linterChanged = true;
          changed = true;
          const newLine = Math.max(1, item.line + deltaLines);
          const newEndLine = item.endLine !== undefined ? Math.max(newLine, item.endLine + deltaLines) : undefined;
          return {
            ...item,
            line: newLine,
            ...(newEndLine !== undefined ? { endLine: newEndLine } : {}),
          };
        }
        return item;
      });
      if (linterChanged) {
        nextLinter.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
        this.linterIndex.set(canonicalKey, nextLinter);
      }
    }

    if (changed) {
      this.notify(canonicalKey, 'shift');
    }
  }

  private setBoundedAlias(key: string, canonical: string): void {
    if (this.aliasMap.has(key)) {
      this.aliasMap.delete(key);
    } else if (this.aliasMap.size >= DiagnosticsCoordinatorRegistry.MAX_ALIAS_MAP_SIZE) {
      const oldest = this.aliasMap.keys().next().value;
      if (oldest !== undefined) {
        this.aliasMap.delete(oldest);
      }
    }
    this.aliasMap.set(key, canonical);
  }

  public registerAlias(canonicalPath: string, alias: string): void {
    if (!canonicalPath || !alias) return;
    const normCanonical = normalizeLatexPath(canonicalPath);
    const normAlias = normalizeLatexPath(alias);
    this.setBoundedAlias(alias, normCanonical);
    this.setBoundedAlias(normAlias, normCanonical);
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
    this.telemetry.totalIngested += errors.length;

    const normDefault = normalizeLatexPath(defaultFile);

    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      // Do not process pure info messages into editor line diagnostics
      if (err.severity === 'info') {
        continue;
      }

      // If an error does not have a specific line, DO NOT force it onto line 1 in the code editor!
      // In Overleaf, errors without line numbers stay in the Compiler Logs panel and do not annotate editor code.
      if (!err.line || err.line < 1) {
        continue;
      }

      const rawFile = err.file ? err.file.trim() : '';
      const canonicalKey = rawFile ? this.resolveCanonicalKey(rawFile) : normDefault;

      const heuristic = !err.suggestion
        ? heuristicLatexErrorFix({
            errorMessage: err.message,
            errorLine: err.line,
            errorFile: err.file || defaultFile,
            detail: err.context,
          })
        : null;

      const suggestion = err.suggestion || heuristic?.explanation;
      const fixedSnippet = err.fixedSnippet || heuristic?.fixedSnippet;
      const originalSnippet = err.originalSnippet || heuristic?.originalSnippet;
      const confidence = heuristic?.confidence;

      const item: IndexedDiagnosticItem = {
        id: `comp-${i}-${err.line}`,
        file: err.file || defaultFile,
        normalizedPath: canonicalKey,
        line: err.line,
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

    this.notify(undefined, 'compiler');
  }

  public getDiagnosticsForFile(fileIdOrPath: string, applyFilter = true): IndexedDiagnosticItem[] {
    const key = this.resolveCanonicalKey(fileIdOrPath);
    let combined = this.combinedFileIndexCache.get(key);

    if (!combined) {
      let compilerItems = this.fileIndex.get(key) || [];
      const linterItems = this.linterIndex.get(key) || [];

      // Guard: A .bib file cannot have LaTeX document-level compiler errors (e.g. Missing \begin{document})
      const isBib = fileIdOrPath.endsWith('.bib') || key.endsWith('.bib');
      if (isBib && compilerItems.length > 0) {
        const isLatexDocError = (msg: string) =>
          /missing \\begin\{document\}|documentclass|emergency stop|fatal error occurred|no output pdf/i.test(msg);
        compilerItems = compilerItems.filter(
          (item) => !isLatexDocError(item.message) && (!item.file || item.file.endsWith('.bib'))
        );
      }

      if (linterItems.length === 0) {
        combined = compilerItems;
      } else if (compilerItems.length === 0) {
        combined = linterItems;
      } else {
        const normalizeMsg = (m: string) =>
          m.toLowerCase().replace(/^(?:!|latex error:|error:|\s)+/g, '').replace(/[\s\r\n]+/g, ' ').trim();
        const seenLineCode = new Set<string>();
        const seenMessages = new Set<string>();
        combined = [];
        for (const item of compilerItems) {
          const norm = normalizeMsg(item.message);
          seenLineCode.add(`${item.line}:${item.code || norm.slice(0, 40)}`);
          seenMessages.add(norm);
          combined.push(item);
        }
        for (const item of linterItems) {
          const norm = normalizeMsg(item.message);
          const itemKey = `${item.line}:${item.code || norm.slice(0, 40)}`;
          // Deduplicate if identical line + message or identical message already exists in compiler items
          if (!seenLineCode.has(itemKey) && !seenMessages.has(norm)) {
            seenLineCode.add(itemKey);
            seenMessages.add(norm);
            combined.push(item);
          }
        }
        combined.sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0));
      }
      this.combinedFileIndexCache.set(key, combined);
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
    this.telemetry.binarySearchQueries++;
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

    const result = items.slice(start, end + 1);
    if (result.length > 0) this.telemetry.queryHits++;
    return result;
  }

  public findDiagnosticsInRange(
    fileIdOrPath: string,
    fromLine: number,
    toLine: number
  ): IndexedDiagnosticItem[] {
    this.telemetry.binarySearchQueries++;
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

    const result = items.slice(startIndex, endIndex + 1);
    if (result.length > 0) this.telemetry.queryHits++;
    return result;
  }

  public getFileSummary(fileIdOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
    const cacheKey = `${canonicalKey}:${applyFilter}`;
    const cached = this.fileSummaryCache.get(cacheKey);
    if (cached) {
      this.telemetry.cacheHits++;
      return cached;
    }

    const items = this.getDiagnosticsForFile(canonicalKey, applyFilter);
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const item of items) {
      if (item.severity === 'error') errorCount++;
      else if (item.severity === 'warning') warningCount++;
      else infoCount++;
    }

    const total = items.length;
    if (total === 0 && errorCount === 0 && warningCount === 0 && infoCount === 0) {
      this.fileSummaryCache.set(cacheKey, EMPTY_DIAGNOSTICS_SUMMARY);
      return EMPTY_DIAGNOSTICS_SUMMARY;
    }
    const nextSummary: FileDiagnosticsSummary = { errorCount, warningCount, infoCount, total, totalCount: total };
    const prevSummary = this.prevFileSummaryCache.get(cacheKey);
    const summary = areSummariesEqual(prevSummary, nextSummary) ? prevSummary! : nextSummary;
    this.fileSummaryCache.set(cacheKey, summary);
    this.prevFileSummaryCache.set(cacheKey, summary);
    return summary;
  }

  public getFolderSummary(folderNameOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    const rawFolder = folderNameOrPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rawFolder) return this.getProjectSummary(applyFilter);

    const cacheKey = `${rawFolder}:${applyFilter}`;
    const cached = this.folderSummaryCache.get(cacheKey);
    if (cached) return cached;

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

    if (total === 0 && errorCount === 0 && warningCount === 0 && infoCount === 0) {
      this.folderSummaryCache.set(cacheKey, EMPTY_DIAGNOSTICS_SUMMARY);
      return EMPTY_DIAGNOSTICS_SUMMARY;
    }
    const nextSummary: FileDiagnosticsSummary = { errorCount, warningCount, infoCount, total, totalCount: total };
    const prevSummary = this.prevFolderSummaryCache.get(cacheKey);
    const summary = areSummariesEqual(prevSummary, nextSummary) ? prevSummary! : nextSummary;
    this.folderSummaryCache.set(cacheKey, summary);
    this.prevFolderSummaryCache.set(cacheKey, summary);
    return summary;
  }

  public getProjectSummary(applyFilter = true): FileDiagnosticsSummary {
    const cached = this.projectSummaryCache.get(applyFilter);
    if (cached) {
      this.telemetry.cacheHits++;
      return cached;
    }

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

    if (total === 0 && errorCount === 0 && warningCount === 0 && infoCount === 0) {
      this.projectSummaryCache.set(applyFilter, EMPTY_DIAGNOSTICS_SUMMARY);
      return EMPTY_DIAGNOSTICS_SUMMARY;
    }
    const nextSummary: FileDiagnosticsSummary = { errorCount, warningCount, infoCount, total, totalCount: total };
    const prevSummary = this.prevProjectSummaryCache.get(applyFilter);
    const summary = areSummariesEqual(prevSummary, nextSummary) ? prevSummary! : nextSummary;
    this.projectSummaryCache.set(applyFilter, summary);
    this.prevProjectSummaryCache.set(applyFilter, summary);
    return summary;
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

  public subscribe(callback: (fileKey?: string, source?: DiagnosticsChangeSource) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getTelemetry(): DiagnosticsTelemetry {
    return { ...this.telemetry };
  }

  public resetTelemetry(): void {
    this.telemetry = {
      totalIngested: 0,
      linterIngested: 0,
      binarySearchQueries: 0,
      queryHits: 0,
      cacheHits: 0,
    };
  }

  public getSnapshot(): DiagnosticsSnapshot {
    const allKeys = new Set([...this.fileIndex.keys(), ...this.linterIndex.keys()]);
    let total = 0;
    for (const key of allKeys) {
      total += (this.fileIndex.get(key)?.length || 0) + (this.linterIndex.get(key)?.length || 0);
    }
    return {
      fileCount: allKeys.size,
      totalDiagnostics: total + this.unmappedDiagnostics.length,
      summary: this.getProjectSummary(false),
    };
  }

  private notify(fileKey?: string, source?: DiagnosticsChangeSource): void {
    this.combinedFileIndexCache.clear();
    this.fileSummaryCache.clear();
    this.folderSummaryCache.clear();
    this.projectSummaryCache.clear();
    for (const listener of this.listeners) {
      try {
        listener(fileKey, source);
      } catch (err) {
        console.error('[DiagnosticsCoordinator] Listener error:', err);
      }
    }
  }
}

export const diagnosticsCoordinator = new DiagnosticsCoordinatorRegistry();

const syncFilterOptions = (state: DocumentSettingsState) => {
  diagnosticsCoordinator.setFilterOptions({
    suppressBadBoxes: state.suppressBadBoxes,
    suppressFontWarnings: state.suppressFontWarnings,
    suppressPackageWarnings: state.suppressPackageWarnings,
    customPatterns: state.customSuppressedWarnings,
  });
};

syncFilterOptions(useSettingsStore.getState());
useSettingsStore.subscribe(syncFilterOptions);

