/**
 * BottomDockPanel.tsx
 *
 * Canonical VS Code-Style Bottom Panel (Block 8: UI Features Layer).
 * Location: `features/editor/ui/features/panel/BottomDockPanel.tsx`
 *
 * Features:
 * - Tabbed navigation: Problems (Errors/Warnings) vs Output (Raw Compiler Logs).
 * - Click-to-Jump: Clicking any diagnostic problem instantly dispatches jump-to-line.
 * - Filter by severity: All, Errors only, Warnings only.
 * - Auto-scroll raw compiler log terminal with copy button.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Terminal,
  X,
  Copy,
  Check,
  Filter,
  FileCode,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLayoutStore, type BottomPanelTab } from '../../../store/layout.store';
import { useCompilerStore } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../coordinators/command-bus';

export function BottomDockPanel() {
  const {
    activeBottomTab,
    setActiveBottomTab,
    setBottomPanelOpen,
  } = useLayoutStore();

  const {
    compileErrors,
    compileLog,
    clearLogs,
  } = useCompilerStore();

  const [copied, setCopied] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs when compileLog updates
  useEffect(() => {
    if (activeBottomTab === 'output' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [compileLog, activeBottomTab]);

  const errorCount = compileErrors.filter((e) => e.severity === 'error' || !e.severity).length;
  const warningCount = compileErrors.filter((e) => e.severity === 'warning').length;

  const filteredErrors = compileErrors.filter((err) => {
    if (filterSeverity === 'error') return err.severity === 'error' || !err.severity;
    if (filterSeverity === 'warning') return err.severity === 'warning';
    return true;
  });

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

  const handleJumpToProblem = (line?: number, file?: string) => {
    if (line == null) return;
    editorCommandBus.dispatch({
      type: 'editor:jump-to-line',
      line,
      highlight: 'error',
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
              <span className="ml-1 px-1 rounded-full text-[10px] font-mono bg-destructive/15 text-destructive font-bold">
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
        <div className="flex items-center gap-1">
          {activeBottomTab === 'problems' && (
            <div className="flex items-center gap-1 mr-2">
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
          )}

          {activeBottomTab === 'output' && (
            <>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 h-5 px-2 rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                title="Copy raw logs"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
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
            className="flex size-5 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
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
                <Check className="size-6 text-emerald-500 mb-1 opacity-70" />
                <p className="text-xs">No problems have been detected in the workspace.</p>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-[10px]">
                    <th className="py-1 px-3 w-8">Type</th>
                    <th className="py-1 px-2 w-36">Location</th>
                    <th className="py-1 px-3">Description</th>
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
                        <td className="py-1 px-3 text-center">
                          {isError ? (
                            <AlertCircle className="size-3.5 text-destructive inline shrink-0" />
                          ) : (
                            <AlertTriangle className="size-3.5 text-warning inline shrink-0" />
                          )}
                        </td>
                        <td className="py-1 px-2 text-muted-foreground group-hover:text-foreground truncate max-w-[150px]">
                          <span className="flex items-center gap-1">
                            <FileCode className="size-3 shrink-0" />
                            <span>{err.file || 'main.tex'}:{err.line ?? 1}</span>
                          </span>
                        </td>
                        <td className="py-1 px-3 text-foreground font-sans text-xs">
                          <span>{err.message}</span>
                          {err.context && (
                            <span className="block text-[11px] font-mono text-muted-foreground mt-0.5 opacity-80">
                              {err.context}
                            </span>
                          )}
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
            {compileLog ? (
              compileLog
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
