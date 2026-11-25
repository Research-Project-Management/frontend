/**
 * compiler.store.ts
 *
 * Store for LaTeX compilation lifecycle, incremental dirty-file tracking, and diagnostic logs.
 */

import { create } from 'zustand';
import { useMemo } from 'react';
import type {
  CompileStatus,
  CompilePhase,
  CompileOutcome,
  CompileReport,
  CompileError,
  ParsedLog,
  LogEntry,
} from '@/features/editor/domain/types/compiler.types';
import type { CompilerDiagnostic } from '@/features/editor/sdk/pages/types';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  diagnosticsToParsedLog,
  cacheBackendParsedLog,
} from '@/features/editor/domain/latex/compiler-logs-parser';
import {
  filterDiagnostics,
  type WarningFilterOptions,
} from '@/features/editor/domain/latex/warning-filter';
import {
  compilerFsmTransition,
  createInitialCompilerFsmContext,
  deriveCompileStatus,
  type CompilerFsmContext,
  type CompilerFsmEvent,
} from '@/features/editor/domain/document/compiler-fsm';

const MAX_LOG_LENGTH = 500_000;

function buildStorePatchFromFsm(
  prevFsm: CompilerFsmContext,
  nextFsm: CompilerFsmContext,
): Partial<DocumentCompilerState> {
  const patch: Partial<DocumentCompilerState> = {
    compilerFsm: nextFsm,
    compilePhase: nextFsm.phase,
    compileOutcome: nextFsm.outcome,
    compileStatus: deriveCompileStatus(nextFsm),
    pendingCompile: nextFsm.hasPendingRun,
  };

  if (nextFsm.report !== prevFsm.report) {
    if (nextFsm.report === null) {
      patch.compileReport = null;
      patch.compileLog = null;
      patch.compileDiagnostics = [];
      patch.parsedLog = null;
      patch.compileErrors = [];
    } else {
      const rawLog = nextFsm.report.logText;
      const trimmedLog = !rawLog
        ? null
        : rawLog.length > MAX_LOG_LENGTH
          ? '... [truncated previous logs]\n' + rawLog.slice(rawLog.length - MAX_LOG_LENGTH)
          : rawLog;

      const structuredParsedLog = diagnosticsToParsedLog(nextFsm.report.diagnostics);
      if (trimmedLog && nextFsm.report.diagnostics.length > 0) {
        cacheBackendParsedLog(trimmedLog, structuredParsedLog);
      }

      const legacyErrors: CompileError[] = nextFsm.report.diagnostics
        .filter((d) => d.severity !== 'info' && d.severity !== 'badbox')
        .map((d) => ({
          line: d.line,
          message: d.message,
          context: d.context,
          file: d.file,
          severity: d.severity,
          source: d.source,
          highlightCommand: d.highlightCommand,
          code: d.code,
          suggestion: d.suggestion,
        }));

      patch.compileReport = {
        ...nextFsm.report,
        logText: trimmedLog,
      };
      patch.compileLog = trimmedLog;
      patch.compileDiagnostics = nextFsm.report.diagnostics;
      patch.parsedLog = structuredParsedLog;
      patch.compileErrors = legacyErrors;
      if (nextFsm.report.compiledAt !== null) {
        patch.lastCompiledAt = nextFsm.report.compiledAt;
      }
    }
  }

  return patch;
}

/**
 * Zero-copy live read-through view of dirty document contents backed directly by `lruDocumentCache`.
 * Eliminates duplicate string maps and per-keystroke Zustand state churn.
 */
class DirtyContentReadThroughMap extends Map<string, string> {
  override get(key: string): string | undefined {
    return lruDocumentCache.isDirty(key) ? lruDocumentCache.getContent(key) : undefined;
  }

  override has(key: string): boolean {
    return lruDocumentCache.isDirty(key);
  }

  override get size(): number {
    return lruDocumentCache.getDirtyFileIds().length;
  }

  override *entries(): MapIterator<[string, string]> {
    for (const model of lruDocumentCache.getDirtyModels()) {
      yield [model.fileId, model.content];
    }
  }

  override *keys(): MapIterator<string> {
    for (const id of lruDocumentCache.getDirtyFileIds()) {
      yield id;
    }
  }

  override *values(): MapIterator<string> {
    for (const model of lruDocumentCache.getDirtyModels()) {
      yield model.content;
    }
  }

  override forEach(
    callbackfn: (value: string, key: string, map: Map<string, string>) => void,
    thisArg?: unknown,
  ): void {
    for (const model of lruDocumentCache.getDirtyModels()) {
      callbackfn.call(thisArg, model.content, model.fileId, this);
    }
  }

  override [Symbol.iterator](): MapIterator<[string, string]> {
    return this.entries();
  }
}

const SHARED_DIRTY_CONTENT_MAP = new DirtyContentReadThroughMap();

export interface DocumentCompilerState {
  // ── Dirty content tracking ─────────────────────────────────────────────
  /** fileId → latest editor content (updated on every keystroke, debounced ~300ms) */
  dirtyContentMap: Map<string, string>;
  /** Set of dirty file IDs for O(1) reactive checking without content churn */
  dirtyFileIds: Set<string>;
  isDirtyFile: (fileId: string) => boolean;
  markDirty: (fileId: string, content: string) => void;
  clearDirty: (fileId: string) => void;
  clearAllDirty: () => void;
  getDirtyFiles: () => Array<{ fileId: string; content: string }>;

  // ── Incremental sync tracking ──────────────────────────────────────────
  /** fileId → unix ms timestamp of last successful sync to the compiler */
  lastSyncedAt: Map<string, number>;
  markSynced: (fileId: string) => void;
  clearSyncTracker: () => void;

  // ── Compile state (FSM-backed single source of truth) ─────────────────
  compilerFsm: CompilerFsmContext;
  compileStatus: CompileStatus;
  compilePhase: CompilePhase;
  compileOutcome: CompileOutcome | null;
  compileReport: CompileReport | null;
  compileLog: string | null;
  /** Parsed error list from the last failed compilation */
  compileErrors: CompileError[];
  /** Full structured diagnostics from backend compiler */
  compileDiagnostics: CompilerDiagnostic[];
  /** Structured ParsedLog from backend diagnostics */
  parsedLog: ParsedLog | null;
  pdfUrl: string | null;
  lastCompiledAt: Date | null;
  pendingCompile: boolean;
  isViewerPoppedOut: boolean;

  dispatchCompileEvent: (event: CompilerFsmEvent) => CompilerFsmContext;
  setCompileStatus: (status: CompileStatus) => void;
  setCompilePhase: (phase: CompilePhase) => void;
  setCompileOutcome: (outcome: CompileOutcome | null) => void;
  applyCompileResult: (report: CompileReport) => void;
  setCompileLog: (log: string | null) => void;
  appendCompileLog: (chunk: string) => void;
  setCompileErrors: (errors: CompileError[]) => void;
  setCompileDiagnostics: (diagnostics: CompilerDiagnostic[]) => void;
  setParsedLog: (parsedLog: ParsedLog | null) => void;
  /** Sets the PDF blob URL, revoking the previous blob URL to prevent leaks */
  setPdfUrl: (url: string | null) => void;
  setLastCompiledAt: (date: Date | null) => void;
  clearLogs: () => void;
  resetCompiler: () => void;
  setPendingCompile: (pending: boolean) => void;
  setIsViewerPoppedOut: (poppedOut: boolean) => void;
}

export const useCompileStore = create<DocumentCompilerState>()((set, get) => ({
  // ── Dirty tracking (Derived directly from lruDocumentCache) ───────────
  dirtyContentMap: SHARED_DIRTY_CONTENT_MAP,
  dirtyFileIds: new Set(),

  isDirtyFile(fileId: string) {
    return lruDocumentCache.isDirty(fileId);
  },

  markDirty(fileId, content) {
    lruDocumentCache.updateContent(fileId, content, true);
  },

  clearDirty(fileId) {
    lruDocumentCache.markClean(fileId);
  },

  clearAllDirty() {
    lruDocumentCache.clearAllDirty();
  },

  getDirtyFiles() {
    return lruDocumentCache.getDirtyModels().map((m) => ({
      fileId: m.fileId,
      content: m.content,
    }));
  },

  // ── Sync tracking ─────────────────────────────────────────────────────
  lastSyncedAt: new Map(),

  markSynced(fileId) {
    set((s) => {
      const next = new Map(s.lastSyncedAt);
      next.set(fileId, Date.now());
      return { lastSyncedAt: next };
    });
  },

  clearSyncTracker() {
    set({ lastSyncedAt: new Map() });
  },

  // ── Compile state (FSM-backed SSOT) ──────────────────────────────────
  compilerFsm: createInitialCompilerFsmContext(),
  compileStatus: 'idle',
  compilePhase: 'idle',
  compileOutcome: null,
  compileReport: null,
  compileLog: null,
  compileErrors: [],
  compileDiagnostics: [],
  parsedLog: null,
  pdfUrl: null,
  lastCompiledAt: null,
  pendingCompile: false,
  isViewerPoppedOut: false,

  dispatchCompileEvent(event) {
    const prevFsm = get().compilerFsm;
    const nextFsm = compilerFsmTransition(prevFsm, event);
    if (nextFsm === prevFsm) {
      return prevFsm;
    }
    set(buildStorePatchFromFsm(prevFsm, nextFsm));
    return nextFsm;
  },

  setCompileStatus(status) {
    get().dispatchCompileEvent({ type: 'FORCE_STATUS', status });
  },

  setCompilePhase(phase) {
    set((s) => ({
      compilerFsm: { ...s.compilerFsm, phase },
      compilePhase: phase,
    }));
  },

  setCompileOutcome(outcome) {
    set((s) => ({
      compilerFsm: { ...s.compilerFsm, outcome },
      compileOutcome: outcome,
    }));
  },

  applyCompileResult(report) {
    get().dispatchCompileEvent({ type: 'RUN_SETTLED', report });
  },

  setCompileLog(log) {
    if (!log) {
      set({ compileLog: null });
      return;
    }
    const trimmed =
      log.length > MAX_LOG_LENGTH
        ? '... [truncated previous logs]\n' + log.slice(log.length - MAX_LOG_LENGTH)
        : log;
    set({ compileLog: trimmed });
  },

  appendCompileLog(chunk) {
    if (!chunk) return;
    const prev = get().compileLog;
    const combined = prev ? `${prev}\n${chunk}` : chunk;
    const trimmed =
      combined.length > MAX_LOG_LENGTH
        ? '... [truncated previous logs]\n' + combined.slice(combined.length - MAX_LOG_LENGTH)
        : combined;
    set({ compileLog: trimmed });
  },

  setCompileErrors(errors) {
    set({ compileErrors: errors });
  },

  setCompileDiagnostics(diagnostics) {
    set({ compileDiagnostics: diagnostics });
  },

  setParsedLog(parsedLog) {
    set({ parsedLog });
  },

  setPdfUrl(url) {
    // Revoke the old blob URL before setting the new one to prevent memory leaks,
    // but only when the URL actually changes to avoid invalidating the active PDF.
    const prev = get().pdfUrl;
    if (prev && prev.startsWith('blob:') && prev !== url) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // Ignore revocation errors
      }
    }
    set({ pdfUrl: url });
  },

  setLastCompiledAt(date) {
    set({ lastCompiledAt: date });
  },

  clearLogs() {
    get().dispatchCompileEvent({ type: 'CLEAR_LOGS' });
  },

  resetCompiler() {
    const currentUrl = get().pdfUrl;
    if (currentUrl && currentUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentUrl);
      } catch {
        // Ignore revocation errors
      }
    }
    const prevFsm = get().compilerFsm;
    set({
      ...buildStorePatchFromFsm(prevFsm, createInitialCompilerFsmContext()),
      compileReport: null,
      compileLog: null,
      compileDiagnostics: [],
      parsedLog: null,
      compileErrors: [],
      lastCompiledAt: null,
      lastSyncedAt: new Map(),
      pdfUrl: null,
    });
  },

  setPendingCompile(pending) {
    get().dispatchCompileEvent({
      type: pending ? 'QUEUE_SUPERSEDE' : 'CONSUME_PENDING',
    });
  },

  setIsViewerPoppedOut(poppedOut) {
    if (get().isViewerPoppedOut !== poppedOut) {
      set({ isViewerPoppedOut: poppedOut });
    }
    if (useWorkspaceStore.getState().isPdfDetached !== poppedOut) {
      useWorkspaceStore.getState().setPdfDetached(poppedOut);
    }
  },
}));

// Keep useWorkspaceStore.isPdfDetached and useCompileStore.isViewerPoppedOut bidirectionally synchronized
useWorkspaceStore.subscribe(
  (s) => s.isPdfDetached,
  (isPdfDetached) => {
    if (useCompileStore.getState().isViewerPoppedOut !== isPdfDetached) {
      useCompileStore.setState({ isViewerPoppedOut: isPdfDetached });
    }
  },
);

// Keep useCompileStore.dirtyFileIds and dirtyContentMap reactively synchronized from lruDocumentCache
function syncCompilerDirtyState() {
  const nextDirtyIds = new Set(lruDocumentCache.getDirtyFileIds());
  const currentState = useCompileStore.getState();

  let idsChanged = nextDirtyIds.size !== currentState.dirtyFileIds.size;
  if (!idsChanged) {
    for (const id of nextDirtyIds) {
      if (!currentState.dirtyFileIds.has(id)) {
        idsChanged = true;
        break;
      }
    }
  }

  if (idsChanged || currentState.dirtyContentMap !== SHARED_DIRTY_CONTENT_MAP) {
    useCompileStore.setState({
      dirtyFileIds: nextDirtyIds,
      dirtyContentMap: SHARED_DIRTY_CONTENT_MAP,
    });
  }
}

lruDocumentCache.subscribe(syncCompilerDirtyState);

const TRANSIENT_REF_CITE_WARNING_REGEX =
  /(?:^|Warning:\s*)(?:Reference|Citation)\s+.+undefined\s+on\s+input\s+line/i;

export interface CompileFilterSettings extends WarningFilterOptions {
  stopOnFirstError?: boolean;
  applyFilter?: boolean;
}

export interface FilteredCompileDiagnosticsResult {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
  allWarnings: LogEntry[];
  allBadBoxes: LogEntry[];
  suppressedCount: number;
  totalVisible: number;
}

const EMPTY_FILTERED_DIAGNOSTICS: FilteredCompileDiagnosticsResult = {
  errors: [],
  warnings: [],
  badBoxes: [],
  allWarnings: [],
  allBadBoxes: [],
  suppressedCount: 0,
  totalVisible: 0,
};

export function selectFilteredCompileDiagnostics(
  report: CompileReport | null | undefined,
  filterSettings: CompileFilterSettings = {},
  fallbackParsedLog?: ParsedLog | null,
): FilteredCompileDiagnosticsResult {
  const baseParsed: ParsedLog | null =
    report && report.diagnostics.length > 0
      ? diagnosticsToParsedLog(report.diagnostics)
      : fallbackParsedLog ?? null;

  if (!baseParsed) {
    return EMPTY_FILTERED_DIAGNOSTICS;
  }

  const errors = baseParsed.errors;
  const nonTransientWarnings =
    filterSettings.stopOnFirstError && errors.length > 0
      ? baseParsed.warnings.filter(
          (w) => !TRANSIENT_REF_CITE_WARNING_REGEX.test(w.message || ''),
        )
      : baseParsed.warnings;

  const filterOpts: WarningFilterOptions = {
    suppressBadBoxes: filterSettings.suppressBadBoxes,
    suppressFontWarnings: filterSettings.suppressFontWarnings,
    suppressPackageWarnings: filterSettings.suppressPackageWarnings,
    customPatterns: filterSettings.customPatterns,
  };

  const applyFilter = filterSettings.applyFilter !== false;
  const hiddenWarningsCount =
    nonTransientWarnings.length - filterDiagnostics(nonTransientWarnings, filterOpts).length;
  const hiddenBadBoxesCount =
    baseParsed.badBoxes.length - filterDiagnostics(baseParsed.badBoxes, filterOpts).length;

  const warnings = applyFilter
    ? filterDiagnostics(nonTransientWarnings, filterOpts)
    : nonTransientWarnings;
  const badBoxes = applyFilter
    ? filterDiagnostics(baseParsed.badBoxes, filterOpts)
    : baseParsed.badBoxes;

  return {
    errors,
    warnings,
    badBoxes,
    allWarnings: nonTransientWarnings,
    allBadBoxes: baseParsed.badBoxes,
    suppressedCount: hiddenWarningsCount + hiddenBadBoxesCount,
    totalVisible: errors.length + warnings.length + badBoxes.length,
  };
}

export function useFilteredCompileDiagnostics(
  fallbackParsedLog?: ParsedLog | null,
  applyFilter = true,
): FilteredCompileDiagnosticsResult {
  const compileReport = useCompileStore((s) => s.compileReport);
  const parsedLog = useCompileStore((s) => s.parsedLog);
  const suppressBadBoxes = useSettingsStore((s) => s.suppressBadBoxes);
  const suppressFontWarnings = useSettingsStore((s) => s.suppressFontWarnings);
  const suppressPackageWarnings = useSettingsStore((s) => s.suppressPackageWarnings);
  const customPatterns = useSettingsStore((s) => s.customSuppressedWarnings);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);

  return useMemo(
    () =>
      selectFilteredCompileDiagnostics(
        compileReport,
        {
          suppressBadBoxes,
          suppressFontWarnings,
          suppressPackageWarnings,
          customPatterns,
          stopOnFirstError,
          applyFilter,
        },
        fallbackParsedLog ?? parsedLog,
      ),
    [
      compileReport,
      parsedLog,
      fallbackParsedLog,
      suppressBadBoxes,
      suppressFontWarnings,
      suppressPackageWarnings,
      customPatterns,
      stopOnFirstError,
      applyFilter,
    ],
  );
}

export type { CompileStatus, CompilePhase, CompileOutcome, CompileReport, CompileError };
