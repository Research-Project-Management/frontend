/**
 * BottomDockPanel.tsx
 *
 * Canonical VS Code / Overleaf-Style Bottom Dock Panel (Block 8: UI Features Layer).
 * Location: `features/editor/ui/features/panel/BottomDockPanel.tsx`
 *
 * Capabilities:
 * - Tabbed navigation: Problems (Errors/Warnings) vs Compiler Output (Raw engine logs).
 * - High-craft IDE dock tabs: Edge-to-edge flush tabs with 2px primary blue active indicator.
 * - LaTeX Log Syntax Highlighting: Semantic colorization for Errors (!), Warnings, Info, and Output.
 * - Interactive Error Jump: Clickable l.<digits> in raw logs and O(1) jump-to-line from Problems table.
 * - 1-Click AI Fix: Sends diagnostic error directly to AI Assistant in Left Sidebar.
 * - Real-time filtering: Search keyword filter, severity selector, and "Errors only" toggle chip.
 * - Responsive Scaling: Horizontal collapsing controls and smooth word wrap.
 * - Strictly compliant with DESIGN.md and WCAG AA accessibility standards.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Terminal,
  X,
  Copy,
  Check,
  Filter,
  FileCode,
  Search,
  Bot,
  Trash2,
  WrapText,
  Play,
  ArrowDown,
  Loader2,
  Wand2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useLayoutStore } from '../../../store/layout.store';
import { useCompilerStore, type CompileError } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../coordinators/command-bus';

interface ParsedLogLine {
  text: string;
  originalIndex: number;
  type: 'error' | 'warning' | 'info' | 'success' | 'asset' | 'normal';
  jumpLine?: number;
}

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

  const [fixingLine, setFixingLine] = useState<number | null>(null);

  const handle1ClickAiFix = (e: React.MouseEvent, err: CompileError) => {
    e.stopPropagation();
    const line = err.line ?? 1;
    setFixingLine(line);

    editorCommandBus.dispatch({
      type: 'ai:autofix-diagnostic',
      diagnostic: {
        id: `diag-${Date.now()}`,
        message: err.message,
        line,
        file: err.file || 'main.tex',
        severity: err.severity === 'warning' ? 'warning' : 'error',
        context: err.context,
      },
    });

    setTimeout(() => {
      setFixingLine(null);
    }, 1500);
  };

  const handleAskAiToFix = (e: React.MouseEvent, err: CompileError) => {
    e.stopPropagation();
    editorCommandBus.dispatch({
      type: 'editor:suggest-fix',
      error: {
        message: err.message,
        line: err.line ?? undefined,
        file: err.file ?? undefined,
        context: err.context ?? undefined,
      },
    });
    // Open AI Sidebar panel immediately so the user sees the solution
    editorCommandBus.dispatch({
      type: 'sidebar:open-panel',
      panel: 'AI',
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
        {/* ── 1. Canonical Dock Header Bar ────────────────────────────────────────── */}
        <div className="h-8 shrink-0 flex items-center justify-between border-b border-border bg-surface px-2">
          {/* Left Dock Tabs */}
          <div className="flex items-center h-full">
            {/* Problems Tab */}
            <button
              type="button"
              role="tab"
              aria-selected={activeBottomTab === 'problems'}
              onClick={() => setActiveBottomTab('problems')}
              className={cn(
                'relative flex items-center gap-1.5 h-full px-3 text-12 font-medium cursor-pointer transition-colors border-r border-border/60 outline-none select-none',
                activeBottomTab === 'problems'
                  ? 'text-foreground bg-canvas font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
              )}
            >
              <AlertCircle
                className={cn(
                  'size-3.5 shrink-0 transition-colors',
                  errorCount > 0 ? 'text-destructive' : 'text-foreground'
                )}
              />
              <span>Problems</span>
              {(errorCount > 0 || warningCount > 0) && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.2 rounded-full text-11 font-mono font-medium',
                    errorCount > 0
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-warning/15 text-warning'
                  )}
                >
                  {errorCount + warningCount}
                </span>
              )}
            </button>

            {/* Compiler Output Tab */}
            <button
              type="button"
              role="tab"
              aria-selected={activeBottomTab === 'output'}
              onClick={() => setActiveBottomTab('output')}
              className={cn(
                'relative flex items-center gap-1.5 h-full px-3 text-12 font-medium cursor-pointer transition-colors border-r border-border/60 outline-none select-none',
                activeBottomTab === 'output'
                  ? 'text-foreground bg-canvas font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
              )}
            >
              <Terminal className="size-3.5 shrink-0 text-foreground" />
              <span>Compiler Output</span>
              {compileStatus === 'compiling' ? (
                <Loader2 className="size-3 text-primary animate-spin ml-0.5 shrink-0" />
              ) : errorCount > 0 ? (
                <span className="size-1.5 rounded-full bg-destructive ml-0.5 shrink-0" />
              ) : compileLog ? (
                <span className="size-1.5 rounded-full bg-success/80 ml-0.5 shrink-0" />
              ) : null}
            </button>
          </div>

          {/* Right Toolbar Actions (VS Code / Overleaf Standard: Grouped & Ghost Icons) */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* ── TAB 1 CONTROLS: PROBLEMS ── */}
            {activeBottomTab === 'problems' && (
              <>
                {/* 1. Severity Filter (Primary Categorization Scope) */}
                <div className="hidden sm:flex items-center p-0.5 rounded-md bg-muted/40 text-11">
                  <button
                    type="button"
                    onClick={() => setFilterSeverity('all')}
                    className={cn(
                      'px-2 py-0.5 rounded-xs font-medium transition-colors cursor-pointer',
                      filterSeverity === 'all'
                        ? 'bg-canvas text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    All ({compileErrors.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterSeverity('error')}
                    className={cn(
                      'px-2 py-0.5 rounded-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                      filterSeverity === 'error'
                        ? 'bg-canvas text-destructive shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-destructive'
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                    <span>Errors ({errorCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterSeverity('warning')}
                    className={cn(
                      'px-2 py-0.5 rounded-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                      filterSeverity === 'warning'
                        ? 'bg-canvas text-warning shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-warning'
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-warning shrink-0" />
                    <span>Warnings ({warningCount})</span>
                  </button>
                </div>

                {/* 1-Click AI AutoFix Header Action */}
                {compileErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const firstErr = compileErrors.find((err) => err.severity === 'error') || compileErrors[0];
                      if (firstErr) handle1ClickAiFix(e, firstErr);
                    }}
                    title="1-Click AI AutoFix for first error in workspace"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-11 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <Wand2 className="size-3 shrink-0" />
                    <span>AutoFix</span>
                  </button>
                )}

                {/* Narrow screen select fallback */}
                <div className="flex sm:hidden items-center">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as any)}
                    className="bg-canvas border border-border/70 text-11 font-medium text-foreground rounded-md h-6 px-1.5 outline-none cursor-pointer"
                  >
                    <option value="all">All ({compileErrors.length})</option>
                    <option value="error">Errors ({errorCount})</option>
                    <option value="warning">Warnings ({warningCount})</option>
                  </select>
                </div>

                {/* 2. Search Filter Input (Keyword Search within Scope) */}
                <div className="flex items-center gap-1.5 px-2 h-6 rounded-md border border-border/70 bg-canvas text-12 w-28 sm:w-44 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Search className="size-3 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter problems..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="bg-transparent border-none outline-none text-12 w-full text-foreground placeholder:text-muted-foreground/60 min-w-0"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                      title="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── TAB 2 CONTROLS: COMPILER OUTPUT ── */}
            {activeBottomTab === 'output' && (
              <>
                {/* 1. "Errors Only" Toggle Button (Scope Filter) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowLogErrorsOnly((v) => !v)}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0',
                        showLogErrorsOnly
                          ? 'bg-destructive/15 text-destructive font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                      aria-label="Filter: Errors only"
                    >
                      <AlertCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showLogErrorsOnly ? 'Showing errors only (Click to show all)' : 'Filter: Errors only'}
                  </TooltipContent>
                </Tooltip>

                {/* 2. Search Filter Input */}
                <div className="flex items-center gap-1.5 px-2 h-6 rounded-md border border-border/70 bg-canvas text-12 w-28 sm:w-40 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Search className="size-3 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter output..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-12 w-full text-foreground placeholder:text-muted-foreground/60 min-w-0"
                  />
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => setLogSearch('')}
                      className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                      title="Clear filter"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Divider between Filter and Actions */}
                <div className="h-3.5 w-px bg-border/60 mx-0.5 shrink-0" />

                {/* 3. Word Wrap Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setWrapLines((w) => !w)}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0',
                        wrapLines
                          ? 'text-primary bg-primary/10 hover:bg-primary/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                      aria-label="Toggle word wrap"
                    >
                      <WrapText className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {wrapLines ? 'Disable Word Wrap' : 'Enable Word Wrap (Alt+Z)'}
                  </TooltipContent>
                </Tooltip>

                {/* 4. Copy Output */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      disabled={!compileLog}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed',
                        copied
                          ? 'text-success bg-success/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                      aria-label="Copy compiler output"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied ? 'Copied to clipboard!' : 'Copy Output to Clipboard'}
                  </TooltipContent>
                </Tooltip>

                {/* 5. Clear Output */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={clearLogs}
                      disabled={!compileLog && compileErrors.length === 0}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Clear compiler output"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Compiler Output</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* ── Universal Close Dock Button ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setBottomPanelOpen(false)}
                  aria-label="Close bottom panel"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0 ml-1"
                >
                  <X className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Close Panel (Ctrl+J)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── 2. Panel Content Canvas ─────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-hidden bg-canvas relative">
          {/* TAB 1: PROBLEMS VIEW */}
          {activeBottomTab === 'problems' && (
            <div className="h-full w-full overflow-y-auto">
              {filteredErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-foreground p-6 select-none">
                  <div className="size-9 rounded-full bg-success/15 text-success flex items-center justify-center mb-2">
                    <Check className="size-5 shrink-0" />
                  </div>
                  <p className="text-13 font-semibold text-foreground">
                    {searchFilter
                      ? 'No problems matching your filter'
                      : 'No problems detected in the workspace'}
                  </p>
                  <p className="text-12 text-muted-foreground mt-0.5">
                    {searchFilter
                      ? 'Try refining or clearing your filter query.'
                      : 'LaTeX source parsed cleanly with zero diagnostic errors.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left font-sans text-12 border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground text-11 font-medium uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                      <th className="py-1.5 px-3 w-12 text-center">Type</th>
                      <th className="py-1.5 px-3 w-40 sm:w-48">Location</th>
                      <th className="py-1.5 px-3">Description</th>
                      <th className="py-1.5 px-3 w-28 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredErrors.map((err, idx) => {
                      const isError = err.severity === 'error' || !err.severity;
                      return (
                        <tr
                          key={idx}
                          onClick={() => handleJumpToProblem(err.line, err.file)}
                          className="border-b border-border/40 hover:bg-muted/25 transition-colors cursor-pointer group"
                        >
                          {/* Severity Type */}
                          <td className="py-2 px-3 text-center align-top">
                            {isError ? (
                              <AlertCircle className="size-3.5 text-destructive inline shrink-0" />
                            ) : (
                              <AlertTriangle className="size-3.5 text-warning inline shrink-0" />
                            )}
                          </td>

                          {/* File & Line Location */}
                          <td className="py-2 px-3 align-top">
                            <span className="flex items-center gap-1.5 font-mono text-12">
                              <FileCode className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="truncate font-medium text-foreground max-w-[130px] sm:max-w-[170px]">
                                {err.file || 'main.tex'}
                              </span>
                              <span className="text-primary font-semibold shrink-0">
                                :{err.line ?? 1}
                              </span>
                            </span>
                          </td>

                          {/* Error Description & Context */}
                          <td className="py-2 px-3 align-top min-w-0">
                            <span className="font-medium text-foreground leading-normal block">
                              {err.message}
                            </span>
                            {err.context && (
                              <div className="font-mono text-11 text-foreground/85 bg-muted/40 border border-border/50 rounded-md p-2 mt-1.5 leading-relaxed whitespace-pre-wrap select-text">
                                {err.context}
                              </div>
                            )}
                          </td>

                          {/* AI Fix CTA Action Buttons */}
                          <td className="py-2 px-3 text-right align-top w-36 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handle1ClickAiFix(e, err)}
                                disabled={fixingLine === (err.line ?? 1)}
                                title="1-Click AI Fix: Generate inline ghost diff directly in CodeMirror (Tab to accept)"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-11 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                {fixingLine === (err.line ?? 1) ? (
                                  <Loader2 className="size-3 animate-spin shrink-0" />
                                ) : (
                                  <Wand2 className="size-3 shrink-0" />
                                )}
                                <span className="font-semibold">1-Click Fix</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleAskAiToFix(e, err)}
                                title="Ask AI Research Assistant in sidebar"
                                className="inline-flex items-center justify-center size-6 rounded-md text-ai hover:bg-ai/15 border border-ai/20 transition-colors cursor-pointer shrink-0"
                              >
                                <Bot className="size-3 shrink-0" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: OUTPUT VIEW (Terminal-Grade LaTeX Compiler Logs) */}
          {activeBottomTab === 'output' && (
            <div
              ref={logContainerRef}
              onScroll={handleLogScroll}
              className="h-full w-full overflow-y-auto font-mono text-12 bg-canvas text-foreground select-text"
            >
              {parsedLogLines.length > 0 ? (
                <div className="p-2 space-y-0.5">
                  {parsedLogLines.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start hover:bg-muted/30 group py-0.5 rounded-xs transition-colors',
                        item.type === 'error' &&
                          'bg-destructive/10 text-destructive font-semibold border-l-2 border-destructive px-1.5'
                      )}
                    >
                      {/* Gutter Line Number */}
                      <span className="w-10 text-right pr-3 select-none text-muted-foreground/35 text-11 font-mono shrink-0 pt-0.5">
                        {item.originalIndex}
                      </span>

                      {/* Line Content */}
                      <div
                        className={cn(
                          'flex-1 min-w-0 pr-3 font-mono text-12 leading-relaxed',
                          wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                          item.type === 'error' && 'text-destructive',
                          item.type === 'warning' && 'text-warning font-medium',
                          item.type === 'success' && 'text-success font-semibold',
                          item.type === 'info' && 'text-muted-foreground/80',
                          item.type === 'asset' && 'text-muted-foreground/50 text-11',
                          item.type === 'normal' && 'text-foreground'
                        )}
                      >
                        {item.jumpLine ? (
                          <span>
                            {item.text.split(new RegExp(`(l\\.${item.jumpLine})`)).map((part, pIdx) => {
                              if (part === `l.${item.jumpLine}`) {
                                return (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => handleJumpToProblem(item.jumpLine)}
                                    className="inline-flex items-center text-primary font-bold underline decoration-dotted hover:text-primary-hover cursor-pointer px-1 py-0.2 rounded hover:bg-primary/10 transition-colors"
                                    title={`Jump to line ${item.jumpLine} in editor`}
                                  >
                                    {part}
                                  </button>
                                );
                              }
                              return part;
                            })}
                          </span>
                        ) : (
                          item.text
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : compileLog ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
                  <Filter className="size-6 text-muted-foreground/60 mb-2" />
                  <p className="text-13 font-semibold text-foreground">
                    {showLogErrorsOnly
                      ? 'No explicit error markers found in log'
                      : `No log lines matching "${logSearch}"`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogErrorsOnly(false);
                      setLogSearch('');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-md border border-border bg-surface text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    Reset log filters
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
                  <div className="size-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mb-2.5">
                    <Terminal className="size-5 shrink-0" />
                  </div>
                  <p className="text-13 font-semibold text-foreground">No compiler output yet</p>
                  <p className="text-12 text-muted-foreground max-w-sm mt-1 leading-normal">
                    Trigger LaTeX compilation to view engine diagnostics, package load logs, and PDF
                    generation status.
                  </p>
                  <button
                    type="button"
                    onClick={handleTriggerCompile}
                    className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-12 font-medium hover:bg-primary-hover transition-colors cursor-pointer shadow-none active:scale-[0.98]"
                  >
                    <Play className="size-3.5 fill-current shrink-0" />
                    <span>Compile Document (Ctrl+Enter)</span>
                  </button>
                </div>
              )}

              {/* Floating "Scroll to Bottom" Button */}
              {isScrolledUp && (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/95 border border-border shadow-md text-11 font-medium text-foreground hover:bg-muted transition-all cursor-pointer select-none z-10 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2"
                >
                  <ArrowDown className="size-3 text-primary shrink-0" />
                  <span>Scroll to bottom</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BottomDockPanel;
