'use client';

/**
 * CompilerLogs.tsx
 *
 * Canonical Overleaf-parity Compiler Logs & Output Files Panel (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/CompilerLogs.tsx`
 *
 * Capabilities:
 * - Top Header: [Recompile ▾] + [Back to PDF] button + Overleaf error stepper (F8 / Shift+F8)
 * - Filter Tabs: All logs (count), Errors (count), Warnings (count), Info (count)
 * - Collapsible: > Raw logs accordion
 * - Error entries with AI Error Assist (suggest & apply fixes directly)
 * - Bottom Bar: [Clear cached files] + [Other logs and files ▴]
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { fetchLogEntryExplanation, useLogViewerActions } from './hooks/useLogViewerActions';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { editorCommandBus, usePageStore, useSettingsStore, workspaceCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { listAuxFiles, suggestLatexFix, manuscriptService } from '@/features/editor/sdk/pages.service';
import { type AuxFileItem } from '@/features/editor/sdk/pages/types';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';

import type { LogEntry, ParsedLog, CompilerLogsProps, LogsProps, ErrorExplanationDto } from '@/features/editor/domain/types/compiler.types';

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
import { filterDiagnostics } from '@/features/editor/domain/latex/warning-filter';
import { CompilerLogEntryRow } from './logs/CompilerLogEntryRow';
import { CompilerLogsHeader } from './logs/CompilerLogsHeader';
import {
  CompilerLogsFilterTabs,
  type TabType,
} from './logs/CompilerLogsFilterTabs';
import { CompilerLogsFooter } from './logs/CompilerLogsFooter';

export { parseLatexLog };
export type { LogEntry, ParsedLog, CompilerLogsProps, LogsProps, ErrorExplanationDto };

export function CompilerLogs({
  log,
  parsedLog: externalParsedLog,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
  onStopCompilation,
  onCompile,
}: CompilerLogsProps & { onStopCompilation?: () => void }) {
  const scratchTargetId = usePageStore(
    (s) => s.rootPageId || s.parentPageId || s.currentPage?.id || s.spaceId || s.projectId,
  );
  const scratchIsPageScoped = usePageStore((s) =>
    Boolean(s.rootPageId || s.parentPageId || (s.currentPage?.id && !s.projectId && !s.spaceId)),
  );
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const storeParsedLog = useCompileStore((s) => s.parsedLog);
  const storeDiagnostics = useCompileStore((s) => s.compileDiagnostics);
  const { engine } = useEditorInstance();
  const [remoteParsedLog, setRemoteParsedLog] = useState<ParsedLog | null>(null);

  useEffect(() => {
    if (externalParsedLog || (storeDiagnostics && storeDiagnostics.length > 0) || !log || !log.trim()) {
      setRemoteParsedLog(null);
      return;
    }
    let active = true;
    manuscriptService.diagnostics
      .parseLog(log)
      .then((report) => {
        if (!active || !report?.items) return;
        const converted = diagnosticsToParsedLog(report.items);
        cacheBackendParsedLog(log, converted);
        setRemoteParsedLog(converted);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [externalParsedLog, storeDiagnostics, log]);

  const parsed = useMemo(() => {
    if (externalParsedLog) return externalParsedLog;
    if (storeParsedLog && (storeParsedLog.errors.length > 0 || storeParsedLog.warnings.length > 0 || storeParsedLog.badBoxes.length > 0)) {
      return storeParsedLog;
    }
    if (storeDiagnostics && storeDiagnostics.length > 0) {
      return diagnosticsToParsedLog(storeDiagnostics);
    }
    if (remoteParsedLog) return remoteParsedLog;
    return parseLatexLog(log);
  }, [externalParsedLog, storeParsedLog, storeDiagnostics, remoteParsedLog, log]);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRawLogsOpen, setIsRawLogsOpen] = useState(false);

  // Warning suppression settings
  const suppressBadBoxes = useSettingsStore((s) => s.suppressBadBoxes);
  const suppressFontWarnings = useSettingsStore((s) => s.suppressFontWarnings);
  const suppressPackageWarnings = useSettingsStore((s) => s.suppressPackageWarnings);
  const customSuppressedWarnings = useSettingsStore((s) => s.customSuppressedWarnings);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);

  const [filterSuppressed, setFilterSuppressed] = useState(true);

  const filterOptions = useMemo(
    () => ({
      suppressBadBoxes,
      suppressFontWarnings,
      suppressPackageWarnings,
      customPatterns: customSuppressedWarnings,
    }),
    [suppressBadBoxes, suppressFontWarnings, suppressPackageWarnings, customSuppressedWarnings]
  );

  // Official Overleaf `output-files.ts` lines 16 & 137-140:
  // When stopped-on-first-error, hide transient Reference/Citation undefined warnings that disappear after a second pass
  const nonTransientWarnings = useMemo(() => {
    if (stopOnFirstError && parsed.errors.length > 0) {
      const transientRegex = /(?:^|Warning:\s*)(?:Reference|Citation)\s+.+undefined\s+on\s+input\s+line/i;
      return parsed.warnings.filter((w) => !transientRegex.test(w.message || ''));
    }
    return parsed.warnings;
  }, [parsed.warnings, parsed.errors.length, stopOnFirstError]);

  const displayedWarnings = useMemo(() => {
    if (!filterSuppressed) return nonTransientWarnings;
    return filterDiagnostics(nonTransientWarnings, filterOptions);
  }, [nonTransientWarnings, filterSuppressed, filterOptions]);

  const displayedBadBoxes = useMemo(() => {
    if (!filterSuppressed) return parsed.badBoxes;
    return filterDiagnostics(parsed.badBoxes, filterOptions);
  }, [parsed.badBoxes, filterSuppressed, filterOptions]);

  const suppressedCount = useMemo(() => {
    const hiddenWarnings = nonTransientWarnings.length - filterDiagnostics(nonTransientWarnings, filterOptions).length;
    const hiddenBadBoxes = parsed.badBoxes.length - filterDiagnostics(parsed.badBoxes, filterOptions).length;
    return hiddenWarnings + hiddenBadBoxes;
  }, [nonTransientWarnings, parsed.badBoxes, filterOptions]);

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

  const handleApplyQuickFix = (
    entry: LogEntry,
    quickFix: { description: string; replacementText: string },
  ) => {
    applyQuickFix(entry, quickFix);
  };

  // Auxiliary files list
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
  }, [scratchTargetId]);

  const outputFiles = useMemo(() => {
    if (auxFiles && auxFiles.length > 0) {
      const names = auxFiles.map((f) => f.name);
      return Array.from(new Set([...names, ...(log && log.trim() ? ['output.log'] : [])]));
    }
    return DEFAULT_OUTPUT_FILES;
  }, [auxFiles, log]);

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

  const handleDownloadOutputFile = useCallback((fileName: string) => {
    if (fileName === 'output.log' && log && log.trim()) {
      handleDownloadRawLog();
    } else {
      downloadFile(fileName);
    }
  }, [downloadFile, handleDownloadRawLog, log]);

  // AI Error Assist state
  const [fixState, setFixState] = useState<
    Record<string, { loading: boolean; result?: AiErrorFixResult; proposed?: boolean; applied?: boolean }>
  >({});

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

  const getEntryKey = useCallback((entry: LogEntry, index: number) =>
    `${entry.file || ''}-${entry.line || 0}-${entry.message}-${index}`, []);

  const handleSuggestFix = useCallback(async (entry: LogEntry, index: number) => {
    const key = getEntryKey(entry, index);
    if (fixState[key]?.result && !fixState[key].loading) {
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
        pageId: pageStore.rootPageId || pageStore.parentPageId || pageStore.currentPage?.id || undefined,
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
  }, [engine, fixState, getEntryKey]);

  const handleApplyFix = useCallback((entry: LogEntry, fix: AiErrorFixResult, index: number) => {
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
  }, [applyAiFix, getEntryKey]);

  // Lifted explanation drawer state so virtualized row unmounts never lose open state or fetched guides
  const [explainState, setExplainState] = useState<
    Record<string, { open: boolean; loading: boolean; explanation?: ErrorExplanationDto | null }>
  >({});

  const getExplainKey = useCallback(
    (type: 'error' | 'warning' | 'badbox', entry: LogEntry, index: number) =>
      `${type}-${getEntryKey(entry, index)}`,
    [getEntryKey],
  );

  const handleToggleExplain = useCallback(
    async (type: 'error' | 'warning' | 'badbox', entry: LogEntry, index: number) => {
      const explainKey = getExplainKey(type, entry, index);
      const current = explainState[explainKey];
      if (current?.open) {
        setExplainState((prev) => ({
          ...prev,
          [explainKey]: { ...prev[explainKey], open: false, loading: false },
        }));
        return;
      }

      if (type === 'error') {
        const aiKey = getEntryKey(entry, index);
        if (fixState[aiKey]?.result) {
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
    [explainState, fixState, getEntryKey, getExplainKey, handleSuggestFix],
  );

  const visibleRows = useMemo(() => {
    const rows: Array<{
      rowKey: string;
      domId: string;
      type: 'error' | 'warning' | 'badbox';
      entry: LogEntry;
      categoryIndex: number;
    }> = [];

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

  // Listen for editor:suggest-fix command from editor CodeMirror gutter or tooltip
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
      const { error } = cmd;
      setActiveTab('errors');

      const idx = parsed.errors.findIndex(
        (e: LogEntry) =>
          (error.line && e.line === error.line) ||
          (error.message && (e.message.includes(error.message) || error.message.includes(e.message)))
      );

      const targetIdx = idx !== -1 ? idx : parsed.errors.length > 0 ? 0 : -1;
      if (targetIdx !== -1) {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          scrollToErrorEntryRef.current(targetIdx, 'center');
        }, 120);
      }
    });
    return () => {
      unsub();
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [parsed.errors]);

  const handleEntryClick = useCallback((entry: LogEntry) => {
    if (entry.line) {
      const targetFile = entry.file || useSettingsStore.getState().mainFile || DEFAULT_MAIN_FILE;
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
  }, [onJumpToError]);

  // Overleaf-parity error stepping (F8 / Shift+F8)
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

  // Sync with external error-stepped events from navigation coordinator
  useEffect(() => {
    const unsubStepped = editorCommandBus.subscribe('editor:error-stepped', (cmd) => {
      if (cmd.errorIndex !== undefined && cmd.errorIndex >= 0) {
        setCurrentErrorIdx(cmd.errorIndex);
        scrollToErrorEntryRef.current(cmd.errorIndex, 'nearest');
      }
    });

    return () => {
      unsubStepped();
    };
  }, []);

  const renderDiagnosticRow = (row: (typeof visibleRows)[number]) => {
    const { entry, categoryIndex, type, rowKey, domId } = row;
    const explainKey = getExplainKey(type, entry, categoryIndex);
    const expState = explainState[explainKey];

    if (type === 'error') {
      const aiKey = getEntryKey(entry, categoryIndex);
      const aiState = fixState[aiKey];
      return (
        <CompilerLogEntryRow
          key={rowKey}
          id={domId}
          type="error"
          entry={entry}
          onClick={() => handleEntryClick(entry)}
          onSuggestFix={() => handleSuggestFix(entry, categoryIndex)}
          isFixLoading={aiState?.loading}
          fixResult={aiState?.result}
          isFixProposed={aiState?.proposed}
          isFixApplied={aiState?.applied}
          onApplyFix={(_entry, fix) => handleApplyFix(entry, fix, categoryIndex)}
          onApplyQuickFix={handleApplyQuickFix}
          isExplainOpen={Boolean(expState?.open)}
          fetchedExplanation={expState?.explanation ?? null}
          isExplaining={Boolean(expState?.loading)}
          onToggleExplain={() => void handleToggleExplain('error', entry, categoryIndex)}
        />
      );
    }

    return (
      <CompilerLogEntryRow
        key={rowKey}
        id={domId}
        type={type}
        entry={entry}
        onClick={() => handleEntryClick(entry)}
        onApplyQuickFix={handleApplyQuickFix}
        isExplainOpen={Boolean(expState?.open)}
        fetchedExplanation={expState?.explanation ?? null}
        isExplaining={Boolean(expState?.loading)}
        onToggleExplain={() => void handleToggleExplain(type, entry, categoryIndex)}
      />
    );
  };

  const totalLogsCount = parsed.errors.length + displayedWarnings.length + displayedBadBoxes.length;

  return (
    <div className="h-full w-full flex flex-col bg-canvas text-foreground overflow-hidden font-sans">
      {/* ── Top Header Toolbar (Overleaf 1:1 Parity) ── */}
      <CompilerLogsHeader
        onCompile={onCompile}
        onClearCacheAndCompile={onClearCacheAndCompile}
        onStopCompilation={onStopCompilation}
        onClose={onClose}
        totalErrors={parsed.errors.length}
        currentErrorIdx={currentErrorIdx}
        onPrevError={handlePrevError}
        onNextError={handleNextError}
      />

      {/* ── Filter Tabs (All logs, Errors, Warnings, Info) ── */}
      <CompilerLogsFilterTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalLogsCount={totalLogsCount}
        errorsCount={parsed.errors.length}
        warningsCount={displayedWarnings.length}
        badBoxesCount={displayedBadBoxes.length}
        suppressedCount={suppressedCount}
        filterSuppressed={filterSuppressed}
        onToggleFilterSuppressed={() => setFilterSuppressed((prev) => !prev)}
      />

      {/* ── Main Body ── */}
      {compileStatus === 'error' && parsed.errors.length === 0 && !log?.toLowerCase().includes('aborted') ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-transparent">
          <PlaneErrorState
            title="Compilation failed"
            description="The LaTeX compiler encountered an error or terminated prematurely. Check the raw logs below to diagnose the issue."
            error={log ? new Error(log.slice(-1000)) : new Error('LaTeX engine failed to compile document.')}
          />
        </div>
      ) : activeTab === 'all' && totalLogsCount === 0 && !log ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-transparent">
          <PlaneEmptyState
            variant="review"
            title="No compilation issues"
            description="Your document compiled cleanly with zero errors or warnings."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 px-3 rounded-md text-xs font-medium gap-1.5 cursor-pointer shadow-none"
              >
                <ChevronLeft className="size-3.5 shrink-0" />
                <span>Back to PDF</span>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-background font-mono select-text">
          {/* Collapsible: > Raw logs accordion (Overleaf 1:1 Match) */}
          <div id="raw-latex-logs" className="shrink-0 border-b border-border/60 bg-background">
            <div className="flex items-center px-3 py-2 hover:bg-muted/60 transition-colors">
              <button
                type="button"
                aria-expanded={isRawLogsOpen}
                aria-controls="raw-latex-logs-content"
                onClick={() => setIsRawLogsOpen((prev) => !prev)}
                className="flex items-center gap-2 text-left font-medium text-xs text-foreground cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border w-full"
              >
                <ChevronRight
                  className={cn('size-3.5 text-muted-foreground transition-transform duration-150', isRawLogsOpen && 'rotate-90')}
                />
                <span>Raw logs</span>
              </button>
            </div>
            {isRawLogsOpen && (
              <pre id="raw-latex-logs-content" className="p-3 border-t border-border/60 bg-muted/20 font-mono text-12 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text">
                {log || 'No compilation logs recorded yet.'}
              </pre>
            )}
          </div>

          {/* Diagnostic Entries List */}
          <div ref={logsScrollRef} className="flex-1 min-h-0 overflow-y-auto bg-background">
            {isVirtualized ? (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = visibleRows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <div
                      key={row.rowKey}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {renderDiagnosticRow(row)}
                    </div>
                  );
                })}
              </div>
            ) : (
              visibleRows.map((row) => renderDiagnosticRow(row))
            )}

            {/* Empty States */}
            {activeTab === 'errors' && parsed.errors.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation errors"
                  description="Your document compiled without any LaTeX errors."
                />
              </div>
            )}
            {activeTab === 'warnings' && displayedWarnings.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation warnings"
                  description="No layout warnings or unresolved reference warnings found."
                />
              </div>
            )}
            {activeTab === 'info' && displayedBadBoxes.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No layout notices"
                  description="No bad boxes or formatting diagnostics reported."
                />
              </div>
            )}
            {activeTab === 'all' && totalLogsCount === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation issues"
                  description="Your document compiled cleanly with zero errors or warnings."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Action Bar (Clear cached files & Other logs and files) ── */}
      <CompilerLogsFooter
        onClearCacheAndCompile={handleClearCacheAndCompile}
        outputFiles={outputFiles}
        onDownloadFile={handleDownloadOutputFile}
        onDownloadAll={downloadAllArtifacts}
      />
    </div>
  );
}

export default CompilerLogs;
