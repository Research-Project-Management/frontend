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

import { logger } from '@/shared/lib/logger';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';
import { normalizeLatexPath } from '@/features/editor/domain/latex/dependency-graph';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { type WarningFilterOptions, filterDiagnostics } from '@/features/editor/domain/latex/warning-filter';
import { useSettingsStore, type DocumentSettingsState } from '@/features/editor/core/store/settings.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsTelemetry,
  type DiagnosticsSnapshot,
  type DiagnosticsChangeSource,
  EMPTY_DIAGNOSTICS_SUMMARY,
  areSummariesEqual,
  areDiagnosticsEqual,
  buildIndexedCompilerErrorItem,
  shiftDiagnosticItemsList,
  remapDiagnosticItemsWithChangeSet,
  type ChangeSetLike,
  type TextDocLike,
  mergeCompilerAndLinterItems,
  binarySearchDiagnosticsAtLine,
  binarySearchDiagnosticsInRange,
  summarizeDiagnosticItems,
} from './diagnostics-query-index';

export {
  EMPTY_DIAGNOSTICS_SUMMARY,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsTelemetry,
  type DiagnosticsSnapshot,
  type DiagnosticsChangeSource,
};

export class DiagnosticsCoordinator {
  private static readonly MAX_ALIAS_MAP_SIZE = 500;
  private fileIndex = new Map<string, IndexedDiagnosticItem[]>();
  private linterIndex = new Map<string, IndexedDiagnosticItem[]>();
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
    const wasEmpty = this.fileIndex.size === 0 && this.linterIndex.size === 0;
    this.fileIndex.clear();
    this.linterIndex.clear();
    this.aliasMap.clear();
    if (!wasEmpty) {
      this.notify(undefined, 'clear');
    }
  }

  public setFilterOptions(
    options: WarningFilterOptions & { enableLinter?: boolean; enableSpellcheck?: boolean },
  ): void {
    const prev = this.filterOptions as WarningFilterOptions & {
      enableLinter?: boolean;
      enableSpellcheck?: boolean;
    };
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

  public ingestLinterDiagnostics(fileIdOrPath: string, diagnostics: IndexedDiagnosticItem[]): void {
    if (!fileIdOrPath) return;
    this.telemetry.linterIngested += diagnostics.length;
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);
    const prev = this.linterIndex.get(canonicalKey);
    if (areDiagnosticsEqual(prev, diagnostics)) {
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
    const compShift = shiftDiagnosticItemsList(this.fileIndex.get(canonicalKey), fromLine, deltaLines);
    if (compShift.changed && compShift.shifted) {
      this.fileIndex.set(canonicalKey, compShift.shifted);
      changed = true;
    }

    const linterShift = shiftDiagnosticItemsList(this.linterIndex.get(canonicalKey), fromLine, deltaLines);
    if (linterShift.changed && linterShift.shifted) {
      this.linterIndex.set(canonicalKey, linterShift.shifted);
      changed = true;
    }

    if (changed) {
      this.notify(canonicalKey, 'shift');
    }
  }

  public remapDiagnosticsWithChangeSet(
    fileIdOrPath: string,
    oldDoc: TextDocLike,
    changes: ChangeSetLike,
    newDoc: { lines: number; lineAt(pos: number): { number: number } },
  ): void {
    if (!fileIdOrPath) return;
    const canonicalKey = this.resolveCanonicalKey(fileIdOrPath);

    let changed = false;
    const compRemap = remapDiagnosticItemsWithChangeSet(
      this.fileIndex.get(canonicalKey),
      oldDoc,
      changes,
      newDoc,
      true,
    );
    if (compRemap.changed && compRemap.remapped) {
      this.fileIndex.set(canonicalKey, compRemap.remapped);
      changed = true;
    }

    const linterRemap = remapDiagnosticItemsWithChangeSet(
      this.linterIndex.get(canonicalKey),
      oldDoc,
      changes,
      newDoc,
      false,
    );
    if (linterRemap.changed && linterRemap.remapped) {
      this.linterIndex.set(canonicalKey, linterRemap.remapped);
      changed = true;
    }

    if (changed) {
      this.notify(canonicalKey, 'shift');
    }
  }

  private setBoundedAlias(key: string, canonical: string): void {
    if (this.aliasMap.has(key)) {
      this.aliasMap.delete(key);
    } else if (this.aliasMap.size >= DiagnosticsCoordinator.MAX_ALIAS_MAP_SIZE) {
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

  private hasIndexedPrefix(prefix: string): boolean {
    for (const key of this.fileIndex.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    for (const key of this.linterIndex.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  public renamePath(oldPath: string, newPath: string): void {
    if (!oldPath || !newPath) return;
    const cleanOld = normalizeVirtualPath(oldPath);
    const cleanNew = normalizeVirtualPath(newPath);
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    const normOldFile = normalizeLatexPath(oldPath);
    const normNewFile = normalizeLatexPath(newPath);
    const oldPrefix = `${cleanOld}/`;
    const isFolderPrefix = this.hasIndexedPrefix(oldPrefix);

    let migrated = false;
    for (const indexMap of [this.fileIndex, this.linterIndex]) {
      for (const [key, items] of Array.from(indexMap.entries())) {
        let nextKey: string | null = null;
        if (key === cleanOld || (!isFolderPrefix && key === normOldFile)) {
          nextKey =
            key === cleanOld && !cleanOld.includes('.') && !indexMap.has(normOldFile)
              ? cleanNew
              : normNewFile;
        } else if (key.startsWith(oldPrefix)) {
          nextKey = `${cleanNew}/${key.slice(oldPrefix.length)}`;
        }
        if (nextKey && nextKey !== key) {
          indexMap.delete(key);
          const updatedItems = items.map((item) => ({
            ...item,
            file: nextKey,
            normalizedPath: nextKey,
          }));
          const existing = indexMap.get(nextKey);
          if (existing) {
            const merged = [...existing, ...updatedItems].sort(
              (a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0),
            );
            indexMap.set(nextKey, merged);
          } else {
            indexMap.set(nextKey, updatedItems);
          }
          this.registerAlias(nextKey, key);
          migrated = true;
        }
      }
    }

    for (const [aliasKey, target] of Array.from(this.aliasMap.entries())) {
      if (target === cleanOld || (!isFolderPrefix && target === normOldFile)) {
        this.aliasMap.set(aliasKey, normNewFile);
      } else if (target.startsWith(oldPrefix)) {
        this.aliasMap.set(aliasKey, `${cleanNew}/${target.slice(oldPrefix.length)}`);
      }
    }

    if (!isFolderPrefix || !migrated) {
      this.registerAlias(newPath, oldPath);
    }

    this.prevFileSummaryCache.clear();
    this.prevFolderSummaryCache.clear();
    this.prevProjectSummaryCache.clear();
    this.notify(normNewFile, 'clear');
  }

  public removePath(targetPath: string): void {
    if (!targetPath) return;
    const cleanTarget = normalizeVirtualPath(targetPath);
    if (!cleanTarget) return;

    const normTargetFile = normalizeLatexPath(targetPath);
    const targetPrefix = `${cleanTarget}/`;
    const isFolderPrefix = this.hasIndexedPrefix(targetPrefix);

    let removed = false;
    for (const indexMap of [this.fileIndex, this.linterIndex]) {
      for (const key of Array.from(indexMap.keys())) {
        const exactMatch =
          key === cleanTarget || (!isFolderPrefix && key === normTargetFile);
        if (exactMatch || key.startsWith(targetPrefix)) {
          indexMap.delete(key);
          removed = true;
        }
      }
    }

    let aliasRemoved = false;
    for (const [aliasKey, target] of Array.from(this.aliasMap.entries())) {
      const aliasMatches =
        aliasKey === targetPath ||
        aliasKey === cleanTarget ||
        (!isFolderPrefix && aliasKey === normTargetFile) ||
        aliasKey.startsWith(targetPrefix);
      const targetMatches =
        target === cleanTarget ||
        (!isFolderPrefix && target === normTargetFile) ||
        target.startsWith(targetPrefix);
      if (aliasMatches || targetMatches) {
        this.aliasMap.delete(aliasKey);
        aliasRemoved = true;
      }
    }

    if (removed || aliasRemoved) {
      this.prevFileSummaryCache.clear();
      this.prevFolderSummaryCache.clear();
      this.prevProjectSummaryCache.clear();
      this.notify(undefined, 'clear');
    }
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
    this.telemetry.totalIngested += errors.length;

    const normDefault = normalizeLatexPath(defaultFile);

    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      if (err.severity === 'info') continue;
      if (!err.line || err.line < 1) continue;

      const rawFile = err.file ? err.file.trim() : '';
      const canonicalKey = rawFile ? this.resolveCanonicalKey(rawFile) : normDefault;
      const item = buildIndexedCompilerErrorItem(err, i, canonicalKey, defaultFile);

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
      combined = mergeCompilerAndLinterItems(
        fileIdOrPath,
        key,
        this.fileIndex.get(key) || [],
        this.linterIndex.get(key) || [],
      );
      this.combinedFileIndexCache.set(key, combined);
    }

    return applyFilter ? filterDiagnostics(combined, this.filterOptions) : combined;
  }

  public findDiagnosticsAtLine(fileIdOrPath: string, targetLine: number): IndexedDiagnosticItem[] {
    this.telemetry.binarySearchQueries++;
    const result = binarySearchDiagnosticsAtLine(this.getDiagnosticsForFile(fileIdOrPath), targetLine);
    if (result.length > 0) this.telemetry.queryHits++;
    return result;
  }

  public findDiagnosticsInRange(
    fileIdOrPath: string,
    fromLine: number,
    toLine: number,
  ): IndexedDiagnosticItem[] {
    this.telemetry.binarySearchQueries++;
    const result = binarySearchDiagnosticsInRange(
      this.getDiagnosticsForFile(fileIdOrPath),
      fromLine,
      toLine,
    );
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

    const nextSummary = summarizeDiagnosticItems(this.getDiagnosticsForFile(canonicalKey, applyFilter));
    if (nextSummary.total === 0) {
      this.fileSummaryCache.set(cacheKey, EMPTY_DIAGNOSTICS_SUMMARY);
      return EMPTY_DIAGNOSTICS_SUMMARY;
    }
    const prevSummary = this.prevFileSummaryCache.get(cacheKey);
    const summary = areSummariesEqual(prevSummary, nextSummary) ? prevSummary! : nextSummary;
    this.fileSummaryCache.set(cacheKey, summary);
    this.prevFileSummaryCache.set(cacheKey, summary);
    return summary;
  }

  public getFolderSummary(folderNameOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    const rawFolder = normalizeVirtualPath(folderNameOrPath.trim().replace(/^["']|["']$/g, ''));
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
      if (key.startsWith(prefix) || key === rawFolder) {
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

    if (total === 0) {
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

    if (total === 0) {
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
      totalDiagnostics: total,
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
        logger.error('[DiagnosticsCoordinator] Listener error', err);
      }
    }
  }
}

export const diagnosticsCoordinator = new DiagnosticsCoordinator();

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

editorCommandBus.subscribe('diagnostics:clear', () => {
  diagnosticsCoordinator.clear();
});
editorCommandBus.subscribe('diagnostics:rename-path', (cmd) => {
  diagnosticsCoordinator.renamePath(cmd.oldPath, cmd.newPath);
});
editorCommandBus.subscribe('diagnostics:remove-path', (cmd) => {
  diagnosticsCoordinator.removePath(cmd.filePath);
});
