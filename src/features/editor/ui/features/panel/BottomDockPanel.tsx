/**
 * BottomDockPanel.tsx
 *
 * Canonical VS Code-Style Bottom Panel (Block 8: UI Features Layer).
 * Location: `features/editor/ui/features/panel/BottomDockPanel.tsx`
 *
 * Features:
 * - Tabbed navigation: Problems (Errors/Warnings) vs Output (Raw Compiler Logs).
 * - O(1) Click-to-Jump: Dispatches navigation:jump-to-line with file path and line,
 *   automatically resolving cross-file models in LRU Cache.
 * - 1-Click AI Fix: Sends diagnostic error directly to AI Assistant in Left Sidebar.
 * - Filter by severity (All, Errors, Warnings) + Real-time text search filter.
 * - Smart log viewer with "Errors Only" filter toggle and copy action.
 * - Zero unnecessary re-renders via narrow Zustand selectors.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLayoutStore } from '../../../store/layout.store';
import { useCompilerStore } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../coordinators/command-bus';

export function BottomDockPanel() {
  // Narrow selectors to isolate BottomDockPanel from unrelated layout/compiler mutations
  const activeBottomTab = useLayoutStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useLayoutStore((s) => s.setActiveBottomTab);
  const setBottomPanelOpen = useLayoutStore((s) => s.setBottomPanelOpen);

  const compileErrors = useCompilerStore((s) => s.compileErrors);
  const compileLog = useCompilerStore((s) => s.compileLog);
  const clearLogs = useCompilerStore((s) => s.clearLogs);

  const [copied, setCopied] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showLogErrorsOnly, setShowLogErrorsOnly] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs when compileLog updates
  useEffect(() => {
    if (activeBottomTab === 'output' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [compileLog, activeBottomTab]);

  const errorCount = useMemo(
    () => compileErrors.filter((e) => e.severity === 'error' || !e.severity).length,
    [compileErrors]
  );
  const warningCount = useMemo(
    () => compileErrors.filter((e) => e.severity === 'warning').length,
    [compileErrors]
  );

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

  const displayLog = useMemo(() => {
    if (!compileLog) return '';
    if (!showLogErrorsOnly) return compileLog;
    const lines = compileLog.split('\n');
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:!|Error:|Fatal error:|l\.\d+|\s*Emergency stop)/i.test(line)) {
        result.push(line);
        // Include up to 2 context lines following the error indicator
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          if (/^!/.test(lines[i + j])) break;
          result.push(`  ${lines[i + j]}`);
        }
      }
    }
    return result.length > 0 ? result.join('\n') : 'No explicit error markers found in log.';
  }, [compileLog, showLogErrorsOnly]);

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

  const handleAskAiToFix = (e: React.MouseEvent, err: any) => {
    e.stopPropagation();
    editorCommandBus.dispatch({
      type: 'editor:suggest-fix',
      error: {
        message: err.message,
        line: err.line,
        file: err.file,
        context: err.context,
      },
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden select-none font-sans text-xs">
      {/* ── Panel Header ──────────────────────────────────────────────────── */}
      <div className="h-8 shrink-0 flex items-center justify-between border-b border-border bg-sidebar px-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1">
          {/* Problems Tab */}
          <button
            type="button"
            onClick={() => setActiveBottomTab('problems')}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2.5 rounded-xs font-medium transition-colors cursor-pointer outline-none',
              activeBottomTab === 'problems'
                ? 'bg-surface text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
            )}
          >
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Problems</span>
            {(errorCount > 0 || warningCount > 0) && (
              <span className="ml-1 px-1 rounded-full text-[10px] font-mono bg-destructive/15 text-destructive font-semibold">
                {errorCount + warningCount}
              </span>
            )}
          </button>

          {/* Output / Terminal Tab */}
          <button
            type="button"
            onClick={() => setActiveBottomTab('output')}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2.5 rounded-xs font-medium transition-colors cursor-pointer outline-none',
              activeBottomTab === 'output'
                ? 'bg-surface text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-hover'
            )}
          >
            <Terminal className="size-3.5 shrink-0" />
            <span>Compiler Output</span>
          </button>
        </div>

        {/* Panel Actions */}
        <div className="flex items-center gap-2">
          {activeBottomTab === 'problems' && (
            <>
              {/* Keyword Filter Input */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-border/70 bg-canvas text-xs max-w-[170px]">
                <Search className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Filter problems..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] w-full placeholder:text-muted-foreground"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Severity Dropdown */}
              <div className="flex items-center gap-1 mr-1">
                <Filter className="size-3 text-muted-foreground" />
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value as any)}
                  className="bg-transparent text-[11px] text-muted-foreground hover:text-foreground border-none outline-none cursor-pointer"
                >
                  <option value="all">All ({compileErrors.length})</option>
                  <option value="error">Errors ({errorCount})</option>
                  <option value="warning">Warnings ({warningCount})</option>
                </select>
              </div>
            </>
          )}

          {activeBottomTab === 'output' && (
            <>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer mr-2 select-none">
                <input
                  type="checkbox"
                  checked={showLogErrorsOnly}
                  onChange={(e) => setShowLogErrorsOnly(e.target.checked)}
                  className="rounded text-primary focus:ring-0 size-3 cursor-pointer"
                />
                <span>Errors only</span>
              </label>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 h-5 px-2 rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                title="Copy raw logs"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={clearLogs}
                className="h-5 px-2 rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer text-[10px]"
                title="Clear logs"
              >
                Clear
              </button>
            </>
          )}

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={() => setBottomPanelOpen(false)}
            aria-label="Close bottom panel"
            className="flex size-5 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer ml-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Panel Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background">
        {/* TAB 1: PROBLEMS VIEW */}
        {activeBottomTab === 'problems' && (
          <div className="h-full w-full overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <Check className="size-6 text-success mb-1 opacity-70" />
                <p className="text-xs">
                  {searchFilter
                    ? 'No problems matching your filter.'
                    : 'No problems have been detected in the workspace.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-[10px]">
                    <th className="py-1 px-3 w-8">Type</th>
                    <th className="py-1 px-2 w-44">Location</th>
                    <th className="py-1 px-3">Description</th>
                    <th className="py-1 px-3 w-20 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.map((err, idx) => {
                    const isError = err.severity === 'error' || !err.severity;
                    return (
                      <tr
                        key={idx}
                        onClick={() => handleJumpToProblem(err.line, err.file)}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-1.5 px-3 text-center align-top">
                          {isError ? (
                            <AlertCircle className="size-3.5 text-destructive inline shrink-0" />
                          ) : (
                            <AlertTriangle className="size-3.5 text-warning inline shrink-0" />
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground group-hover:text-foreground truncate max-w-[180px] align-top">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <FileCode className="size-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{err.file || 'main.tex'}</span>
                            <span className="text-primary font-semibold">:{err.line ?? 1}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-foreground font-sans text-xs align-top">
                          <span className="font-medium text-foreground">{err.message}</span>
                          {err.context && (
                            <span className="block text-[11px] font-mono text-muted-foreground mt-0.5 opacity-80 whitespace-pre-wrap">
                              {err.context}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right align-top">
                          <button
                            type="button"
                            onClick={(e) => handleAskAiToFix(e, err)}
                            title="Ask AI Research Assistant to explain and fix this error"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer shrink-0"
                          >
                            <Sparkles className="size-3" />
                            <span>AI Fix</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: OUTPUT VIEW (Raw compiler logs) */}
        {activeBottomTab === 'output' && (
          <div
            ref={logContainerRef}
            className="h-full w-full overflow-y-auto p-3 font-mono text-[11px] bg-canvas text-foreground whitespace-pre-wrap leading-relaxed select-text"
          >
            {displayLog ? (
              displayLog
            ) : (
              <span className="text-muted-foreground italic">
                No compilation logs yet. Trigger compile (Ctrl+Enter) to view engine output.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomDockPanel;
