/**
 * useCompilerLogsState.ts
 *
 * State, backend log parsing, warning filtering, virtualized row preparation,
 * AI fix & error explanation drawers, F8 error stepper, and artifact download logic
 * for CompilerLogs.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { fetchLogEntryExplanation, useLogViewerActions } from './useLogViewerActions';
import {
  useCompileStore,
  selectFilteredCompileDiagnostics,
} from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { useEditorInstance } from '@/features/editor/core/bus/useEditorInstance';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { listAuxFiles, suggestLatexFix, pagesService } from '@/features/editor/sdk/pages.service';
import { type AuxFileItem } from '@/features/editor/sdk/pages/types';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';
import type {
  LogEntry,
  ParsedLog,
  ErrorExplanationDto,
  CompilerLogFocusTarget,
} from '@/features/editor/domain/types/compiler.types';
import {
  parseLatexLog,
  diagnosticsToParsedLog,
  cacheBackendParsedLog,
  DEFAULT_OUTPUT_FILES,
} from '@/features/editor/domain/latex/compiler-logs-parser';
import {
  DEFAULT_MAIN_FILE,
  COMPILER_LOGS_VIRTUAL_THRESHOLD,
} from '@/features/editor/domain/constants/editor.constants';
import { type TabType } from '../logs/CompilerLogsFilterTabs';

export interface UseCompilerLogsStateOptions {
  log?: string | null;
  parsedLog?: ParsedLog | null;
  onJumpToError?: (file: string, line: number) => void;
  onClearCacheAndCompile?: () => void;
  onCompile?: () => void;
  focusTarget?: CompilerLogFocusTarget | null;
  onFocusTargetHandled?: () => void;
}

function normalizeLogPath(filePath?: string): string {
  return (filePath || '').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase();
}

function scoreLogEntryMatch(entry: LogEntry, target: CompilerLogFocusTarget): number {
  let score = 0;
  if (typeof target.line === 'number' && entry.line === target.line) {
    score += 10;
  }

  const targetMsg = target.message?.trim().toLowerCase() || '';
  const entryMsg = entry.message?.trim().toLowerCase() || '';
  if (targetMsg && entryMsg) {
    if (entryMsg === targetMsg) {
      score += 8;
    } else if (entryMsg.includes(targetMsg) || targetMsg.includes(entryMsg)) {
      score += 5;
    }
  }

  const targetFile = normalizeLogPath(target.file);
  const entryFile = normalizeLogPath(entry.file);
  if (targetFile && entryFile) {
    if (targetFile === entryFile) {
      score += 4;
    } else {
      const targetBase = targetFile.split('/').pop() || '';
      const entryBase = entryFile.split('/').pop() || '';
      if (targetBase && entryBase && targetBase === entryBase) {
        score += 2;
      }
    }
  }

  return score;
}

function findMatchingLogEntry(
  target: CompilerLogFocusTarget,
  errors: LogEntry[],
  warnings: LogEntry[],
  badBoxes: LogEntry[],
): { type: 'error' | 'warning' | 'badbox'; index: number; domId: string } | null {
  const buckets: Array<{ type: 'error' | 'warning' | 'badbox'; prefix: string; items: LogEntry[] }> =
    target.severity === 'warning'
      ? [
          { type: 'warning', prefix: 'warn', items: warnings },
          { type: 'error', prefix: 'err', items: errors },
          { type: 'badbox', prefix: 'info', items: badBoxes },
        ]
      : [
          { type: 'error', prefix: 'err', items: errors },
          { type: 'warning', prefix: 'warn', items: warnings },
          { type: 'badbox', prefix: 'info', items: badBoxes },
        ];

  let best: { type: 'error' | 'warning' | 'badbox'; index: number; domId: string; score: number } | null =
    null;

  for (const bucket of buckets) {
    for (let i = 0; i < bucket.items.length; i += 1) {
      const s = scoreLogEntryMatch(bucket.items[i], target);
      if (s >= 8 && (!best || s > best.score)) {
        best = {
          type: bucket.type,
          index: i,
          domId: `log-entry-${bucket.prefix}-${i}`,
          score: s,
        };
      }
    }
  }

  if (best) {
    return { type: best.type, index: best.index, domId: best.domId };
  }

  if (target.severity === 'warning' && warnings.length > 0) {
    return { type: 'warning', index: 0, domId: 'log-entry-warn-0' };
  }
  if (errors.length > 0) {
    return { type: 'error', index: 0, domId: 'log-entry-err-0' };
  }
  if (warnings.length > 0) {
    return { type: 'warning', index: 0, domId: 'log-entry-warn-0' };
  }
  return null;
}

export interface CompilerLogVisibleRow {
  rowKey: string;
  domId: string;
  type: 'error' | 'warning' | 'badbox';
  entry: LogEntry;
  categoryIndex: number;
}

export function useCompilerLogsState({
  log,
  parsedLog: externalParsedLog,
  onJumpToError,
  onClearCacheAndCompile,
  onCompile,
  focusTarget,
  onFocusTargetHandled,
}: UseCompilerLogsStateOptions) {
  const scratchTargetId = usePageStore(
    (s) => s.rootPageId || s.parentPageId || s.currentPage?.id || s.spaceId || s.projectId,
  );
  const scratchIsPageScoped = usePageStore((s) =>
    Boolean(s.rootPageId || s.parentPageId || (s.currentPage?.id && !s.projectId && !s.spaceId)),
  );
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const compileOutcome = useCompileStore((s) => s.compileOutcome);
  const compileReport = useCompileStore((s) => s.compileReport);
  const storeParsedLog = useCompileStore((s) => s.parsedLog);
  const storeDiagnostics = useCompileStore((s) => s.compileDiagnostics);
  const { engine } = useEditorInstance();
  const [remoteParsedLog, setRemoteParsedLog] = useState<ParsedLog | null>(null);

  useEffect(() => {
    const trimmedLog = log?.trim() ?? '';
    const isProgressStatusOnly =
      trimmedLog.length > 0 &&
      trimmedLog
        .split('\n')
        .every((line) => !line.trim() || /^\[CLSI[^\]]*\]/.test(line.trim()));

    if (
      externalParsedLog ||
      compileReport ||
      (storeDiagnostics && storeDiagnostics.length > 0) ||
      compileStatus === 'compiling' ||
      compileStatus === 'flushing' ||
      compileStatus === 'syncing' ||
      !trimmedLog ||
      isProgressStatusOnly
    ) {
      setRemoteParsedLog(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      (pagesService as any).diagnostics
        ?.parseLog?.(log!)
        ?.then((report: any) => {
          if (!active || !report?.items) return;
          const converted = diagnosticsToParsedLog(report.items);
          cacheBackendParsedLog(log!, converted);
          setRemoteParsedLog(converted);
        })
        .catch(() => {});
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [externalParsedLog, compileReport, storeDiagnostics, compileStatus, log]);

  const parsed = useMemo(() => {
    if (externalParsedLog) return externalParsedLog;
    if (compileReport && compileReport.diagnostics.length > 0) {
      return diagnosticsToParsedLog(compileReport.diagnostics);
    }
    if (
      storeParsedLog &&
      (storeParsedLog.errors.length > 0 ||
        storeParsedLog.warnings.length > 0 ||
        storeParsedLog.badBoxes.length > 0)
    ) {
      return storeParsedLog;
    }
    if (storeDiagnostics && storeDiagnostics.length > 0) {
      return diagnosticsToParsedLog(storeDiagnostics);
    }
    if (remoteParsedLog) return remoteParsedLog;
    return parseLatexLog(log || '');
  }, [externalParsedLog, compileReport, storeParsedLog, storeDiagnostics, remoteParsedLog, log]);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRawLogsOpen, setIsRawLogsOpen] = useState(false);

  const suppressBadBoxes = useSettingsStore((s) => s.suppressBadBoxes);
  const suppressFontWarnings = useSettingsStore((s) => s.suppressFontWarnings);
  const suppressPackageWarnings = useSettingsStore((s) => s.suppressPackageWarnings);
  const customSuppressedWarnings = useSettingsStore((s) => s.customSuppressedWarnings);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);

  const [filterSuppressed, setFilterSuppressed] = useState(true);

  const filteredDiagnostics = useMemo(
    () =>
      selectFilteredCompileDiagnostics(
        externalParsedLog ? null : compileReport,
        {
          suppressBadBoxes,
          suppressFontWarnings,
          suppressPackageWarnings,
          customPatterns: customSuppressedWarnings,
          stopOnFirstError,
          applyFilter: filterSuppressed,
        },
        externalParsedLog ?? parsed,
      ),
    [
      externalParsedLog,
      compileReport,
      parsed,
      suppressBadBoxes,
      suppressFontWarnings,
      suppressPackageWarnings,
      customSuppressedWarnings,
      stopOnFirstError,
      filterSuppressed,
    ],
  );

  const displayedWarnings = filteredDiagnostics.warnings;
  const displayedBadBoxes = filteredDiagnostics.badBoxes;
  const suppressedCount = filteredDiagnostics.suppressedCount;

  const handleClearCacheAndCompile = useCallback(() => {
    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else {
      editorCommandBus.dispatch({ type: 'compiler:trigger', forceClean: true });
    }
  }, [onClearCacheAndCompile]);

  const {
    applyQuickFix,
    applyAiFix,
    downloadFile,
    downloadAllArtifacts,
  } = useLogViewerActions({
    engine,
    projectId: scratchTargetId,
    isPageScoped: scratchIsPageScoped,
    onCompile,
    onClearCacheAndCompile: handleClearCacheAndCompile,
  });

  const handleApplyQuickFix = useCallback(
    (entry: LogEntry, quickFix: { description: string; replacementText: string }) => {
      applyQuickFix(entry, quickFix);
    },
    [applyQuickFix],
  );

  const [auxFiles, setAuxFiles] = useState<AuxFileItem[]>([]);
  useEffect(() => {
    if (scratchTargetId) {
      let isMounted = true;
      listAuxFiles(
        scratchTargetId,
        scratchIsPageScoped ? { isPageScoped: true } : undefined,
      )
        .then((files) => {
          if (isMounted) setAuxFiles(files);
        })
        .catch((err) => {
          if (isMounted) {
            console.warn('[CompilerLogs] Failed to fetch auxiliary files list:', err);
            setAuxFiles([]);
          }
        });
      return () => {
        isMounted = false;
      };
    }
  }, [scratchTargetId, scratchIsPageScoped]);

  const outputFiles = useMemo(() => {
    const bibLogs = compileReport?.logMeta?.bibLogFiles ?? [];
    if (auxFiles && auxFiles.length > 0) {
      const names = auxFiles.map((f) => f.name);
      return Array.from(
        new Set([...names, ...bibLogs, ...(log && log.trim() ? ['output.log'] : [])]),
      );
    }
    if (bibLogs.length > 0) {
      return Array.from(new Set([...DEFAULT_OUTPUT_FILES, ...bibLogs]));
    }
    return DEFAULT_OUTPUT_FILES;
  }, [auxFiles, compileReport?.logMeta?.bibLogFiles, log]);

  const handleDownloadRawLog = useCallback(() => {
    if (!log || !log.trim()) {
      toast.info('No compilation logs available to download', { id: 'download-raw-log' });
      return;
    }
    const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.log';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded output.log');
  }, [log]);

  const handleDownloadFullRawLog = useCallback(() => {
    const artifactUrl = compileReport?.logMeta?.logArtifactUrl;
    if (artifactUrl) {
      window.open(artifactUrl, '_blank');
      return;
    }
    if (compileReport?.logMeta?.truncated && scratchTargetId) {
      downloadFile('output.log');
      return;
    }
    handleDownloadRawLog();
  }, [
    compileReport?.logMeta?.logArtifactUrl,
    compileReport?.logMeta?.truncated,
    scratchTargetId,
    downloadFile,
    handleDownloadRawLog,
  ]);

  const handleDownloadOutputFile = useCallback(
    (fileName: string) => {
      if (fileName === 'output.log' && log && log.trim()) {
        handleDownloadRawLog();
      } else {
        downloadFile(fileName);
      }
    },
    [downloadFile, handleDownloadRawLog, log],
  );

  const [fixState, setFixState] = useState<
    Record<string, { loading: boolean; result?: AiErrorFixResult; proposed?: boolean; applied?: boolean }>
  >({});
  const fixStateRef = useRef(fixState);
  useEffect(() => {
    fixStateRef.current = fixState;
  }, [fixState]);

  useEffect(() => {
    return editorCommandBus.subscribe('ai:diff-resolved', (cmd) => {
      setFixState((prev) => {
        let changed = false;
        const next: typeof prev = { ...prev };
        for (const [k, st] of Object.entries(prev)) {
          if (st.proposed && !st.applied) {
            changed = true;
            next[k] =
              cmd.action === 'accept'
                ? { ...st, proposed: false, applied: true }
                : { ...st, proposed: false };
          }
        }
        return changed ? next : prev;
      });
    });
  }, []);

  const getEntryKey = useCallback(
    (entry: LogEntry, index: number) =>
      `${entry.file || ''}-${entry.line || 0}-${entry.message}-${index}`,
    [],
  );

  const handleSuggestFix = useCallback(
    async (entry: LogEntry, index: number) => {
      const key = getEntryKey(entry, index);
      const currentFixState = fixStateRef.current[key];
      if (currentFixState?.result && !currentFixState.loading) {
        setFixState((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      setFixState((prev) => ({
        ...prev,
        [key]: { loading: true },
      }));

      const pageStore = usePageStore.getState();
      let targetContent = '';
      if (entry.file) {
        const cleanEntryFile = entry.file.replace(/^\/+/, '');
        const projectFiles = workspaceCoordinator.getProjectFiles?.() || [];
        const found = projectFiles.find(
          (f: { id: string; title?: string; name?: string; path?: string }) =>
            f.title === cleanEntryFile ||
            f.name === cleanEntryFile ||
            (f.path && f.path.replace(/^\/+/, '') === cleanEntryFile),
        );
        if (found?.id) {
          const cached = lruDocumentCache.getModel(found.id);
          if (cached?.content) {
            targetContent = cached.content;
          } else if (found.id === pageStore.activeFilePage?.id && engine) {
            targetContent = engine.getContent();
          }
        }
      }
      if (!targetContent && engine) {
        targetContent = engine.getContent();
      }

      let surroundingCode = '';
      if (targetContent && entry.line) {
        const lines = targetContent.split('\n');
        const start = Math.max(0, entry.line - 4);
        const end = Math.min(lines.length, entry.line + 3);
        surroundingCode = lines.slice(start, end).join('\n');
      }

      try {
        const result = await suggestLatexFix({
          errorMessage: entry.message,
          errorLine: entry.line,
          errorFile: entry.file,
          detail: entry.detail,
          surroundingCode,
          spaceId: pageStore.spaceId || pageStore.projectId || undefined,
          pageId:
            pageStore.rootPageId || pageStore.parentPageId || pageStore.currentPage?.id || undefined,
        });

        setFixState((prev) => ({
          ...prev,
          [key]: { loading: false, result },
        }));
      } catch (err) {
        console.warn('[CompilerLogs] AI fix suggestion failed:', err);
        setFixState((prev) => ({
          ...prev,
          [key]: { loading: false },
        }));
      }
    },
    [engine, getEntryKey],
  );

  const handleApplyFix = useCallback(
    (entry: LogEntry, fix: AiErrorFixResult, index: number) => {
      const key = getEntryKey(entry, index);
      applyAiFix(entry, fix, (outcome) => {
        setFixState((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            proposed: outcome === 'proposed',
            applied: outcome === 'applied',
            result: fix,
          },
        }));
      });
    },
    [applyAiFix, getEntryKey],
  );

  const [explainState, setExplainState] = useState<
    Record<string, { open: boolean; loading: boolean; explanation?: ErrorExplanationDto | null }>
  >({});
  const explainStateRef = useRef(explainState);
  useEffect(() => {
    explainStateRef.current = explainState;
  }, [explainState]);

  const getExplainKey = useCallback(
    (type: 'error' | 'warning' | 'badbox', entry: LogEntry, index: number) =>
      `${type}-${getEntryKey(entry, index)}`,
    [getEntryKey],
  );

  const handleToggleExplain = useCallback(
    async (type: 'error' | 'warning' | 'badbox', entry: LogEntry, index: number) => {
      const explainKey = getExplainKey(type, entry, index);
      const current = explainStateRef.current[explainKey];
      if (current?.open) {
        setExplainState((prev) => ({
          ...prev,
          [explainKey]: { ...prev[explainKey], open: false, loading: false },
        }));
        return;
      }

      if (type === 'error') {
        const aiKey = getEntryKey(entry, index);
        if (fixStateRef.current[aiKey]?.result) {
          void handleSuggestFix(entry, index);
        }
      }

      const cachedExp = entry.explanation || current?.explanation;
      if (cachedExp) {
        setExplainState((prev) => ({
          ...prev,
          [explainKey]: { open: true, loading: false, explanation: cachedExp },
        }));
        return;
      }

      setExplainState((prev) => ({
        ...prev,
        [explainKey]: { ...prev[explainKey], open: false, loading: true },
      }));

      try {
        const exp = await fetchLogEntryExplanation(entry);
        setExplainState((prev) => ({
          ...prev,
          [explainKey]: {
            open: Boolean(exp),
            loading: false,
            explanation: exp ?? null,
          },
        }));
      } catch {
        setExplainState((prev) => ({
          ...prev,
          [explainKey]: { ...prev[explainKey], open: false, loading: false },
        }));
      }
    },
    [getEntryKey, getExplainKey, handleSuggestFix],
  );

  const handleSuggestFixRow = useCallback(
    (entry: LogEntry, index = 0) => {
      void handleSuggestFix(entry, index);
    },
    [handleSuggestFix],
  );

  const handleApplyFixRow = useCallback(
    (entry: LogEntry, fix: AiErrorFixResult, index = 0) => {
      handleApplyFix(entry, fix, index);
    },
    [handleApplyFix],
  );

  const handleToggleExplainRow = useCallback(
    (entry: LogEntry, type: 'error' | 'warning' | 'badbox' = 'error', index = 0) => {
      void handleToggleExplain(type, entry, index);
    },
    [handleToggleExplain],
  );

  const visibleRows = useMemo<CompilerLogVisibleRow[]>(() => {
    const rows: CompilerLogVisibleRow[] = [];

    if (activeTab === 'all' || activeTab === 'errors') {
      parsed.errors.forEach((entry: LogEntry, i: number) => {
        rows.push({
          rowKey: `err-${i}`,
          domId: `log-entry-err-${i}`,
          type: 'error',
          entry,
          categoryIndex: i,
        });
      });
    }
    if (activeTab === 'all' || activeTab === 'warnings') {
      displayedWarnings.forEach((entry: LogEntry, i: number) => {
        rows.push({
          rowKey: `warn-${i}`,
          domId: `log-entry-warn-${i}`,
          type: 'warning',
          entry,
          categoryIndex: i,
        });
      });
    }
    if (activeTab === 'all' || activeTab === 'info') {
      displayedBadBoxes.forEach((entry: LogEntry, i: number) => {
        rows.push({
          rowKey: `info-${i}`,
          domId: `log-entry-info-${i}`,
          type: 'badbox',
          entry,
          categoryIndex: i,
        });
      });
    }
    return rows;
  }, [activeTab, parsed.errors, displayedWarnings, displayedBadBoxes]);

  const logsScrollRef = useRef<HTMLDivElement | null>(null);
  const isVirtualized = visibleRows.length >= COMPILER_LOGS_VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => logsScrollRef.current,
    estimateSize: () => 68,
    overscan: 8,
    enabled: isVirtualized,
  });

  const scrollToErrorEntry = useCallback(
    (errorIdx: number, block: ScrollLogicalPosition = 'nearest') => {
      if (errorIdx < 0 || errorIdx >= parsed.errors.length) return;
      if (activeTab !== 'all' && activeTab !== 'errors') {
        setActiveTab('errors');
      }
      if (isVirtualized) {
        rowVirtualizer.scrollToIndex(errorIdx, {
          align: block === 'center' ? 'center' : 'auto',
        });
        requestAnimationFrame(() => {
          const el = document.getElementById(`log-entry-err-${errorIdx}`);
          el?.scrollIntoView?.({ behavior: 'smooth', block });
        });
        return;
      }
      const el = document.getElementById(`log-entry-err-${errorIdx}`);
      el?.scrollIntoView?.({ behavior: 'smooth', block });
    },
    [activeTab, isVirtualized, parsed.errors.length, rowVirtualizer],
  );

  const scrollToErrorEntryRef = useRef(scrollToErrorEntry);
  useEffect(() => {
    scrollToErrorEntryRef.current = scrollToErrorEntry;
  }, [scrollToErrorEntry]);

  const handleEntryClick = useCallback(
    (entry: LogEntry) => {
      if (entry.line) {
        const targetFile = entry.file || usePageStore.getState().mainFilePath || DEFAULT_MAIN_FILE;
        if (onJumpToError) {
          onJumpToError(targetFile, entry.line);
          toast.info(`Jumped to ${targetFile} line ${entry.line}`);
        } else {
          editorCommandBus.dispatch({
            type: 'editor:jump-to-line',
            line: entry.line,
            highlight: 'error',
          });
        }
      }
    },
    [onJumpToError],
  );

  const [currentErrorIdx, setCurrentErrorIdx] = useState<number>(0);

  const handleNextError = useCallback(() => {
    if (parsed.errors.length === 0) return;
    const nextIdx = (currentErrorIdx + 1) % parsed.errors.length;
    setCurrentErrorIdx(nextIdx);
    const err = parsed.errors[nextIdx];
    handleEntryClick(err);
    scrollToErrorEntryRef.current(nextIdx, 'nearest');
  }, [currentErrorIdx, parsed.errors, handleEntryClick]);

  const handlePrevError = useCallback(() => {
    if (parsed.errors.length === 0) return;
    const prevIdx = (currentErrorIdx - 1 + parsed.errors.length) % parsed.errors.length;
    setCurrentErrorIdx(prevIdx);
    const err = parsed.errors[prevIdx];
    handleEntryClick(err);
    scrollToErrorEntryRef.current(prevIdx, 'nearest');
  }, [currentErrorIdx, parsed.errors, handleEntryClick]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevError();
        } else {
          handleNextError();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextError, handlePrevError]);

  useEffect(() => {
    return editorCommandBus.subscribe('editor:error-stepped', (cmd) => {
      if (cmd.errorIndex !== undefined && cmd.errorIndex >= 0) {
        setCurrentErrorIdx(cmd.errorIndex);
        scrollToErrorEntryRef.current(cmd.errorIndex, 'nearest');
      }
    });
  }, []);

  const lastHandledFocusNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focusTarget || lastHandledFocusNonceRef.current === focusTarget.nonce) {
      return;
    }

    const match = findMatchingLogEntry(
      focusTarget,
      parsed.errors,
      displayedWarnings,
      displayedBadBoxes,
    );
    lastHandledFocusNonceRef.current = focusTarget.nonce;

    if (!match) {
      onFocusTargetHandled?.();
      return;
    }

    const targetTab: TabType =
      match.type === 'error'
        ? activeTab === 'all' || activeTab === 'errors'
          ? activeTab
          : 'errors'
        : match.type === 'warning'
          ? activeTab === 'all' || activeTab === 'warnings'
            ? activeTab
            : 'warnings'
          : activeTab === 'all' || activeTab === 'info'
            ? activeTab
            : 'info';

    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }

    if (match.type === 'error') {
      setCurrentErrorIdx(match.index);
    }

    const visibleIdx =
      targetTab !== 'all'
        ? match.index
        : match.type === 'error'
          ? match.index
          : match.type === 'warning'
            ? parsed.errors.length + match.index
            : parsed.errors.length + displayedWarnings.length + match.index;

    if (isVirtualized) {
      rowVirtualizer.scrollToIndex(visibleIdx, { align: 'center' });
    }

    // Wait for the tab switch / virtualizer to commit rows before scrolling.
    setTimeout(() => {
      const el = document.getElementById(match.domId);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 30);

    onFocusTargetHandled?.();
  }, [
    focusTarget,
    parsed.errors,
    displayedWarnings,
    displayedBadBoxes,
    activeTab,
    isVirtualized,
    rowVirtualizer,
    onFocusTargetHandled,
  ]);

  const totalLogsCount =
    parsed.errors.length + displayedWarnings.length + displayedBadBoxes.length;

  return {
    compileStatus,
    compileOutcome,
    compileReport,
    parsed,
    activeTab,
    setActiveTab,
    isRawLogsOpen,
    setIsRawLogsOpen,
    filterSuppressed,
    setFilterSuppressed,
    displayedWarnings,
    displayedBadBoxes,
    suppressedCount,
    totalLogsCount,
    visibleRows,
    logsScrollRef,
    isVirtualized,
    rowVirtualizer,
    currentErrorIdx,
    fixState,
    explainState,
    outputFiles,
    getEntryKey,
    getExplainKey,
    handleEntryClick,
    handleSuggestFix,
    handleApplyFix,
    handleApplyQuickFix,
    handleToggleExplain,
    handleSuggestFixRow,
    handleApplyFixRow,
    handleToggleExplainRow,
    handleNextError,
    handlePrevError,
    handleClearCacheAndCompile,
    handleDownloadOutputFile,
    handleDownloadFullRawLog,
    downloadAllArtifacts,
  };
}
