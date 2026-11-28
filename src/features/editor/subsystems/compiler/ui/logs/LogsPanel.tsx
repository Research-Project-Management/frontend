'use client';

/**
 * CompilerLogs.tsx
 *
 * Canonical Overleaf-parity Compiler Logs & Output Files Panel (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/CompilerLogs.tsx`
 */

import React from 'react';
import { ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import type {
  LogEntry,
  ParsedLog,
  CompilerLogsProps,
} from '@/features/editor/domain/types/compiler.types';
import { parseLatexLog } from '@/features/editor/domain/latex/compiler-logs-parser';
import { CompilerLogEntryRow } from './LogEntryRow';
import { CompilerLogsHeader } from './Header';
import { CompilerLogsFilterTabs } from './FilterTabs';
import { CompilerLogsFooter } from './Footer';
import { CompileOutcomeCard } from './OutcomeCard';
import { RawLatexLogsViewer } from './RawLogsViewer';
import {
  useCompilerLogsState,
  type CompilerLogVisibleRow,
} from '@/features/editor/subsystems/compiler/hooks/useLogsState';

export { parseLatexLog };
export type { LogEntry, ParsedLog, CompilerLogsProps };

export function CompilerLogs({
  log,
  parsedLog: externalParsedLog,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
  onStopCompilation,
  onCompile,
  focusTarget,
  onFocusTargetHandled,
}: CompilerLogsProps & { onStopCompilation?: () => void }) {
  const s = useCompilerLogsState({
    log,
    parsedLog: externalParsedLog,
    onJumpToError,
    onClearCacheAndCompile,
    onCompile,
    focusTarget,
    onFocusTargetHandled,
  });

  const aiAssistEnabled = useSettingsStore((st) => st.aiAssistEnabled);

  const renderDiagnosticRow = (row: CompilerLogVisibleRow) => {
    const { entry, categoryIndex, type, rowKey, domId } = row;

    if (type === 'error') {
      const aiKey = s.getEntryKey(entry, categoryIndex);
      const aiState = s.fixState[aiKey];
      return (
        <CompilerLogEntryRow
          key={rowKey}
          id={domId}
          type="error"
          categoryIndex={categoryIndex}
          entry={entry}
          onClick={s.handleEntryClick}
          onSuggestFix={aiAssistEnabled ? s.handleSuggestFixRow : undefined}
          isFixLoading={aiState?.loading}
          fixResult={aiState?.result}
          isFixProposed={aiState?.proposed}
          isFixApplied={aiState?.applied}
          onApplyFix={s.handleApplyFixRow}
          onApplyQuickFix={s.handleApplyQuickFix}
        />
      );
    }

    return (
      <CompilerLogEntryRow
        key={rowKey}
        id={domId}
        type={type}
        categoryIndex={categoryIndex}
        entry={entry}
        onClick={s.handleEntryClick}
        onApplyQuickFix={s.handleApplyQuickFix}
      />
    );
  };

  const effectiveOutcome =
    s.compileOutcome ?? (s.compileStatus === 'error' ? 'failure' : null);
  const hasOutcomeBanner = Boolean(
    (effectiveOutcome &&
      effectiveOutcome !== 'success' &&
      (effectiveOutcome !== 'failure' || s.parsed.errors.length === 0)) ||
      s.compileReport?.summary?.truncated ||
      (s.compileReport?.summary?.suppressedCascadeCount ?? 0) > 0,
  );
  const isTruncatedLog = Boolean(s.compileReport?.logMeta?.truncated);

  return (
    <div data-testid="compiler-logs-panel" className="h-full w-full flex flex-col bg-canvas text-foreground overflow-hidden font-sans">
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

      {s.activeTab === 'all' && s.totalLogsCount === 0 && !log && !hasOutcomeBanner ? (
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
          {effectiveOutcome && (
            <div className="shrink-0 px-3 pt-2.5">
              <CompileOutcomeCard
                outcome={effectiveOutcome}
                errorCount={s.parsed.errors.length}
                errorMessage={s.compileReport?.errorMessage}
                validationIssues={s.compileReport?.validationIssues}
                summary={s.compileReport?.summary}
                onCompile={onCompile}
                onClearCacheAndCompile={s.handleClearCacheAndCompile}
                onJumpToFirstError={() => {
                  const firstError = s.parsed.errors[0];
                  if (firstError) s.handleEntryClick(firstError);
                }}
              />
            </div>
          )}

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
            {s.activeTab === 'all' && s.totalLogsCount === 0 && !hasOutcomeBanner && (
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

          <div id="raw-latex-logs" className="shrink-0 border-t border-border/60 bg-background">
            <div className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/60 transition-colors">
              <button
                type="button"
                aria-expanded={s.isRawLogsOpen}
                aria-controls="raw-latex-logs-content"
                onClick={() => s.setIsRawLogsOpen((prev) => !prev)}
                className="flex items-center gap-2 text-left font-medium text-xs text-foreground cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border flex-1 min-w-0"
              >
                <ChevronRight
                  className={cn('size-3.5 text-muted-foreground transition-transform duration-150 shrink-0', s.isRawLogsOpen && 'rotate-90')}
                />
                <span>Raw logs</span>
                {isTruncatedLog && (
                  <span className="text-10 font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Truncated preview
                  </span>
                )}
              </button>

              {isTruncatedLog && (
                <button
                  type="button"
                  onClick={s.handleDownloadFullRawLog}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-11 font-medium text-primary hover:bg-muted transition-colors cursor-pointer shrink-0"
                >
                  <Download className="size-3" />
                  <span>Download full output.log</span>
                </button>
              )}
            </div>
            {s.isRawLogsOpen && <RawLatexLogsViewer log={log} />}
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
