/**
 * BottomDockPanel.tsx
 *
 * Canonical VS Code / Overleaf-Style Bottom Dock Panel (Block 8: UI Features Layer).
 * Location: `features/editor/ui/features/panel/BottomDockPanel.tsx`
 *
 * Modularized into:
 * - `bottom-dock/DockHeader.tsx`
 * - `bottom-dock/DockProblemsTab.tsx`
 * - `bottom-dock/DockOutputTab.tsx`
 * - `bottom-dock/dock.types.ts`
 */

'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { useLayoutStore } from '../../../store/layout.store';
import { useCompilerStore, type CompileError } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../coordinators/command-bus';
import {
  DockHeader,
  DockProblemsTab,
  DockOutputTab,
  type ParsedLogLine,
} from './bottom-dock';

export function BottomDockPanel() {
  // Narrow Zustand selectors to prevent unnecessary re-renders
  const activeBottomTab = useLayoutStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useLayoutStore((s) => s.setActiveBottomTab);
  const setBottomPanelOpen = useLayoutStore((s) => s.setBottomPanelOpen);

  const compileErrors = useCompilerStore((s) => s.compileErrors);
  const compileLog = useCompilerStore((s) => s.compileLog);
  const clearLogs = useCompilerStore((s) => s.clearLogs);
  const compileStatus = useCompilerStore((s) => s.compileStatus);

  // Local state
  const [copied, setCopied] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [showLogErrorsOnly, setShowLogErrorsOnly] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs when compileLog updates (unless user scrolled up to inspect)
  useEffect(() => {
    if (activeBottomTab === 'output' && logContainerRef.current && !isScrolledUp) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [compileLog, activeBottomTab, isScrolledUp]);

  // Handle scroll detection for "Scroll to bottom" button
  const handleLogScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    setIsScrolledUp(distanceToBottom > 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    setIsScrolledUp(false);
  }, []);

  // Diagnostic counts
  const errorCount = useMemo(
    () => compileErrors.filter((e) => e.severity === 'error' || !e.severity).length,
    [compileErrors]
  );
  const warningCount = useMemo(
    () => compileErrors.filter((e) => e.severity === 'warning').length,
    [compileErrors]
  );

  // Filtered problems list
  const filteredErrors = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return compileErrors.filter((err) => {
      // 1. Severity filter
      if (filterSeverity === 'error' && err.severity === 'warning') return false;
      if (filterSeverity === 'warning' && (err.severity === 'error' || !err.severity)) return false;

      // 2. Search keyword filter
      if (q) {
        const matchesMsg = err.message?.toLowerCase().includes(q);
        const matchesFile = err.file?.toLowerCase().includes(q);
        const matchesLine = String(err.line || '').includes(q);
        const matchesContext = err.context?.toLowerCase().includes(q);
        return matchesMsg || matchesFile || matchesLine || matchesContext;
      }
      return true;
    });
  }, [compileErrors, filterSeverity, searchFilter]);

  // Process & syntax-highlight LaTeX log lines
  const parsedLogLines = useMemo(() => {
    if (!compileLog) return [];
    const rawLines = compileLog.split('\n');
    const result: ParsedLogLine[] = [];
    const query = logSearch.trim().toLowerCase();

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Real-time text search filter in logs
      if (query && !line.toLowerCase().includes(query)) {
        continue;
      }

      const isError = /^(?:!|Fatal error:|Emergency stop|LaTeX Error:|.*error:)/i.test(line);
      const isWarning =
        /^(?:LaTeX Warning:|Package .* Warning:|Class .* Warning:|Underfull \\hbox|Overfull \\hbox)/i.test(
          line
        );
      const isSuccess = /^(?:Output written on .*|Compilation succeeded)/i.test(line);
      const isInfo = /^(?:Package .* Info:|Document Class:)/i.test(line);
      const isAsset = /^<.*(?:\.pfb|\.ttf|\.otf|\.png|\.pdf|\.eps)>$/i.test(line.trim());

      // "Errors only" filter
      if (showLogErrorsOnly && !isError) {
        continue;
      }

      // Check for interactive jump line pattern (e.g. "l.42 \begin{figure}")
      let jumpLine: number | undefined;
      const lineMatch = line.match(/\bl\.(\d+)\b/);
      if (lineMatch) {
        jumpLine = parseInt(lineMatch[1], 10);
      }

      result.push({
        text: line,
        originalIndex: i + 1,
        type: isError
          ? 'error'
          : isWarning
          ? 'warning'
          : isSuccess
          ? 'success'
          : isInfo
          ? 'info'
          : isAsset
          ? 'asset'
          : 'normal',
        jumpLine,
      });
    }

    return result;
  }, [compileLog, showLogErrorsOnly, logSearch]);

  const handleCopyLogs = async () => {
    if (!compileLog) return;
    try {
      await navigator.clipboard.writeText(compileLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs', err);
    }
  };

  const handleJumpToProblem = (line?: number | null, file?: string | null) => {
    if (line == null) return;
    editorCommandBus.dispatch({
      type: 'navigation:jump-to-line',
      filePath: file || undefined,
      fileId: file || undefined,
      line,
      highlight: 'error',
    });
  };

  const handleAutoFixFirst = (e: React.MouseEvent) => {
    const firstErr: CompileError | undefined =
      compileErrors.find((err) => err.severity === 'error') || compileErrors[0];
    if (!firstErr) return;

    const line = firstErr.line ?? 1;
    editorCommandBus.dispatch({
      type: 'ai:autofix-diagnostic',
      diagnostic: {
        id: `diag-${Date.now()}`,
        message: firstErr.message,
        line,
        file: firstErr.file || 'main.tex',
        severity: firstErr.severity === 'warning' ? 'warning' : 'error',
        context: firstErr.context,
      },
    });
  };

  const handleTriggerCompile = () => {
    editorCommandBus.dispatch({
      type: 'compiler:trigger',
      forceSync: true,
    });
  };

  return (
    <TooltipProvider delayDuration={400} disableHoverableContent>
      <div className="h-full w-full flex flex-col bg-surface overflow-hidden select-none font-sans text-xs">
        {/* Header Bar */}
        <DockHeader
          activeBottomTab={activeBottomTab}
          setActiveBottomTab={setActiveBottomTab}
          errorCount={errorCount}
          warningCount={warningCount}
          compileStatus={compileStatus}
          compileLog={compileLog}
          compileErrorsCount={compileErrors.length}
          filterSeverity={filterSeverity}
          setFilterSeverity={setFilterSeverity}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          onAutoFixFirst={compileErrors.length > 0 ? handleAutoFixFirst : undefined}
          showLogErrorsOnly={showLogErrorsOnly}
          setShowLogErrorsOnly={setShowLogErrorsOnly}
          logSearch={logSearch}
          setLogSearch={setLogSearch}
          wrapLines={wrapLines}
          setWrapLines={setWrapLines}
          copied={copied}
          onCopyLogs={handleCopyLogs}
          onClearLogs={clearLogs}
          onClosePanel={() => setBottomPanelOpen(false)}
        />

        {/* Panel Content Canvas */}
        <div className="flex-1 min-h-0 overflow-hidden bg-canvas relative">
          {activeBottomTab === 'problems' && (
            <DockProblemsTab
              filteredErrors={filteredErrors}
              searchFilter={searchFilter}
            />
          )}

          {activeBottomTab === 'output' && (
            <DockOutputTab
              parsedLogLines={parsedLogLines}
              compileLog={compileLog}
              showLogErrorsOnly={showLogErrorsOnly}
              logSearch={logSearch}
              wrapLines={wrapLines}
              setShowLogErrorsOnly={setShowLogErrorsOnly}
              setLogSearch={setLogSearch}
              logContainerRef={logContainerRef}
              onLogScroll={handleLogScroll}
              isScrolledUp={isScrolledUp}
              onScrollToBottom={scrollToBottom}
              onJumpToLine={handleJumpToProblem}
              onTriggerCompile={handleTriggerCompile}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BottomDockPanel;
