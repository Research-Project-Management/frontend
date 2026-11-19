'use client';

/**
 * CompilerLogs.tsx
 *
 * Canonical Overleaf-parity Compiler Logs & Output Files Panel (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/CompilerLogs.tsx`
 */

import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import type {
  LogEntry,
  ParsedLog,
  CompilerLogsProps,
  LogsProps,
  ErrorExplanationDto,
} from '@/features/editor/domain/types/compiler.types';
import { parseLatexLog } from '@/features/editor/domain/latex/compiler-logs-parser';
import { CompilerLogEntryRow } from './logs/CompilerLogEntryRow';
import { CompilerLogsHeader } from './logs/CompilerLogsHeader';
import { CompilerLogsFilterTabs } from './logs/CompilerLogsFilterTabs';
import { CompilerLogsFooter } from './logs/CompilerLogsFooter';
import {
  useCompilerLogsState,
  type CompilerLogVisibleRow,
} from './hooks/useCompilerLogsState';

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
  const s = useCompilerLogsState({
    log,
    parsedLog: externalParsedLog,
    onJumpToError,
    onClearCacheAndCompile,
    onCompile,
  });

  const renderDiagnosticRow = (row: CompilerLogVisibleRow) => {
    const { entry, categoryIndex, type, rowKey, domId } = row;
    const explainKey = s.getExplainKey(type, entry, categoryIndex);
    const expState = s.explainState[explainKey];

    if (type === 'error') {
      const aiKey = s.getEntryKey(entry, categoryIndex);
      const aiState = s.fixState[aiKey];
      return (
        <CompilerLogEntryRow
          key={rowKey}
          id={domId}
          type="error"
          entry={entry}
          onClick={() => s.handleEntryClick(entry)}
          onSuggestFix={() => s.handleSuggestFix(entry, categoryIndex)}
          isFixLoading={aiState?.loading}
          fixResult={aiState?.result}
          isFixProposed={aiState?.proposed}
          isFixApplied={aiState?.applied}
          onApplyFix={(_entry, fix) => s.handleApplyFix(entry, fix, categoryIndex)}
          onApplyQuickFix={s.handleApplyQuickFix}
          isExplainOpen={Boolean(expState?.open)}
          fetchedExplanation={expState?.explanation ?? null}
          isExplaining={Boolean(expState?.loading)}
          onToggleExplain={() => void s.handleToggleExplain('error', entry, categoryIndex)}
        />
      );
    }

    return (
      <CompilerLogEntryRow
        key={rowKey}
        id={domId}
        type={type}
        entry={entry}
        onClick={() => s.handleEntryClick(entry)}
        onApplyQuickFix={s.handleApplyQuickFix}
        isExplainOpen={Boolean(expState?.open)}
        fetchedExplanation={expState?.explanation ?? null}
        isExplaining={Boolean(expState?.loading)}
        onToggleExplain={() => void s.handleToggleExplain(type, entry, categoryIndex)}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-canvas text-foreground overflow-hidden font-sans">
      <CompilerLogsHeader
        onCompile={onCompile}
        onClearCacheAndCompile={onClearCacheAndCompile}
        onStopCompilation={onStopCompilation}
        onClose={onClose}
        totalErrors={s.parsed.errors.length}
        currentErrorIdx={s.currentErrorIdx}
        onPrevError={s.handlePrevError}
        onNextError={s.handleNextError}
      />

      <CompilerLogsFilterTabs
        activeTab={s.activeTab}
        onSelectTab={s.setActiveTab}
        totalLogsCount={s.totalLogsCount}
        errorsCount={s.parsed.errors.length}
        warningsCount={s.displayedWarnings.length}
        badBoxesCount={s.displayedBadBoxes.length}
        suppressedCount={s.suppressedCount}
        filterSuppressed={s.filterSuppressed}
        onToggleFilterSuppressed={() => s.setFilterSuppressed((prev) => !prev)}
      />

      {s.compileStatus === 'error' && s.parsed.errors.length === 0 && !log?.toLowerCase().includes('aborted') ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-transparent">
          <PlaneErrorState
            title="Compilation failed"
            description="The LaTeX compiler encountered an error or terminated prematurely. Check the raw logs below to diagnose the issue."
            error={log ? new Error(log.slice(-1000)) : new Error('LaTeX engine failed to compile document.')}
          />
        </div>
      ) : s.activeTab === 'all' && s.totalLogsCount === 0 && !log ? (
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
          <div id="raw-latex-logs" className="shrink-0 border-b border-border/60 bg-background">
            <div className="flex items-center px-3 py-2 hover:bg-muted/60 transition-colors">
              <button
                type="button"
                aria-expanded={s.isRawLogsOpen}
                aria-controls="raw-latex-logs-content"
                onClick={() => s.setIsRawLogsOpen((prev) => !prev)}
                className="flex items-center gap-2 text-left font-medium text-xs text-foreground cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border w-full"
              >
                <ChevronRight
                  className={cn('size-3.5 text-muted-foreground transition-transform duration-150', s.isRawLogsOpen && 'rotate-90')}
                />
                <span>Raw logs</span>
              </button>
            </div>
            {s.isRawLogsOpen && (
              <pre id="raw-latex-logs-content" className="p-3 border-t border-border/60 bg-muted/20 font-mono text-12 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text">
                {log || 'No compilation logs recorded yet.'}
              </pre>
            )}
          </div>

          <div ref={s.logsScrollRef} className="flex-1 min-h-0 overflow-y-auto bg-background">
            {s.isVirtualized ? (
              <div
                style={{
                  height: `${s.rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {s.rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = s.visibleRows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <div
                      key={row.rowKey}
                      data-index={virtualRow.index}
                      ref={s.rowVirtualizer.measureElement}
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
              s.visibleRows.map((row) => renderDiagnosticRow(row))
            )}

            {s.activeTab === 'errors' && s.parsed.errors.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation errors"
                  description="Your document compiled without any LaTeX errors."
                />
              </div>
            )}
            {s.activeTab === 'warnings' && s.displayedWarnings.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation warnings"
                  description="No layout warnings or unresolved reference warnings found."
                />
              </div>
            )}
            {s.activeTab === 'info' && s.displayedBadBoxes.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No layout notices"
                  description="No bad boxes or formatting diagnostics reported."
                />
              </div>
            )}
            {s.activeTab === 'all' && s.totalLogsCount === 0 && (
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

      <CompilerLogsFooter
        onClearCacheAndCompile={s.handleClearCacheAndCompile}
        outputFiles={s.outputFiles}
        onDownloadFile={s.handleDownloadOutputFile}
        onDownloadAll={s.downloadAllArtifacts}
      />
    </div>
  );
}

export default CompilerLogs;
