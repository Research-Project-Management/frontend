'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import { usePageStore } from '@/features/editor/store';
import {
  suggestLatexFix,
  type AiErrorFixResult,
} from '@/features/editor/services/ai-error-assist.service';

export interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
}

export interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

export function parseLatexLog(raw: string): ParsedLog {
  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry) => {
    const key = `${entry.file ?? ''}|${entry.line ?? ''}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(entry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
      let lineNum: number | undefined;
      let detail: string | undefined;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          detail = m[2].trim() || undefined;
          break;
        }
      }
      tryAdd(errors, { message, line: lineNum, detail });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (/(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += ' ' + lines[j].trim();
        else break;
      }
      const lineRef = msg.match(/input line (\d+)/);
      tryAdd(warnings, {
        message: msg,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines? (\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  return { errors, warnings, badBoxes };
}

type LogTab = 'errors' | 'warnings' | 'badboxes' | 'raw';

function EntryRow({
  type,
  entry,
  onClick,
  onSuggestFix,
  isFixLoading,
  fixResult,
  isFixApplied,
  onApplyFix,
}: {
  type: 'error' | 'warning' | 'badbox';
  entry: LogEntry;
  onClick?: () => void;
  onSuggestFix?: (entry: LogEntry) => void;
  isFixLoading?: boolean;
  fixResult?: AiErrorFixResult | null;
  isFixApplied?: boolean;
  onApplyFix?: (entry: LogEntry, fix: AiErrorFixResult) => void;
  key?: React.Key;
}) {
  const isClickable = Boolean(entry.line);
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2.5 border-b border-border last:border-0 transition-colors',
        isClickable && 'cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/80 focus-visible:outline-none',
      )}
    >
      <div className="flex items-start gap-2.5">
        {type === 'error' && <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />}
        {type === 'warning' && <AlertTriangle className="size-3.5 text-warning shrink-0 mt-0.5" />}
        {type === 'badbox' && <Info className="size-3.5 text-primary shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground font-mono text-xs leading-snug break-words">
              {entry.message}
            </p>
            {type === 'error' && onSuggestFix && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSuggestFix(entry);
                }}
                className={cn(
                  'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium shrink-0 transition-all border shadow-2xs cursor-pointer',
                  fixResult || isFixLoading
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/40'
                )}
                title="Ask Overleaf AI Error Assist to explain and fix this LaTeX error"
              >
                {isFixLoading ? (
                  <Loader2 className="size-3 animate-spin text-amber-500" />
                ) : (
                  <Sparkles className="size-3 text-amber-500" />
                )}
                <span>Suggest fix</span>
              </button>
            )}
          </div>
          {(entry.file || entry.line !== undefined) && (
            <p className="text-xs mt-0.5 text-muted-foreground">
              {entry.file && <span className="text-foreground/70">{entry.file}</span>}
              {entry.file && entry.line !== undefined && <span> · </span>}
              {entry.line !== undefined && (
                <span className={cn(isClickable && 'underline underline-offset-2 decoration-muted-foreground/40 hover:text-foreground')}>
                  Line {entry.line}
                </span>
              )}
            </p>
          )}
          {entry.detail && (
            <p className="text-muted-foreground/80 text-xs mt-0.5 truncate">{entry.detail}</p>
          )}
        </div>
      </div>

      {/* AI Error Assist Expansion Card */}
      {(isFixLoading || fixResult) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="ml-6 mt-1.5 p-3 rounded-lg bg-card border border-amber-500/30 shadow-sm text-xs space-y-2 select-text"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
              <span>Overleaf AI Error Assist</span>
            </div>
            {fixResult && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium capitalize">
                {fixResult.confidence} confidence
              </span>
            )}
          </div>

          {isFixLoading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>Analyzing LaTeX error and generating fix...</span>
            </div>
          ) : fixResult ? (
            <>
              <p className="text-foreground/90 leading-relaxed">
                {fixResult.explanation}
              </p>

              {/* Code Diff Preview */}
              <div className="rounded-md border border-border/80 overflow-hidden font-mono text-[11px] my-1.5">
                {fixResult.originalSnippet && (
                  <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1.5 border-b border-border/40 whitespace-pre-wrap">
                    <span className="select-none font-bold mr-2 text-rose-500">-</span>
                    {fixResult.originalSnippet}
                  </div>
                )}
                {fixResult.fixedSnippet && (
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 whitespace-pre-wrap">
                    <span className="select-none font-bold mr-2 text-emerald-500">+</span>
                    {fixResult.fixedSnippet}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isFixApplied}
                  onClick={() => onApplyFix?.(entry, fixResult)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer',
                    isFixApplied
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  )}
                >
                  {isFixApplied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Applied & Recompiled</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Apply suggestion</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LogEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
      <CheckCircle2 className="size-5 shrink-0" />
      <span className="text-xs">{text}</span>
    </div>
  );
}

export interface LogsProps {
  log: string;
  onClose: () => void;
  onJumpToError?: (file: string | undefined, line: number) => void;
  onClearCacheAndCompile?: () => void;
}

export default function Logs({
  log,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
}: LogsProps) {
  const { scrollToLineRef, editorRef, compileRef } = usePageStore();
  const parsed = useMemo(() => parseLatexLog(log), [log]);
  const defaultTab = useMemo<LogTab>(() => {
    if (parsed.errors.length > 0) return 'errors';
    if (parsed.warnings.length > 0) return 'warnings';
    if (parsed.badBoxes.length > 0) return 'badboxes';
    return 'raw';
  }, [parsed]);
  const [selectedTab, setSelectedTab] = useState<LogTab | null>(null);
  const activeTab = selectedTab ?? defaultTab;

  // AI Error Assist state
  const [fixState, setFixState] = useState<
    Record<string, { loading: boolean; result?: AiErrorFixResult; applied?: boolean }>
  >({});

  const getEntryKey = (entry: LogEntry, index: number) =>
    `${entry.file || ''}-${entry.line || 0}-${entry.message}-${index}`;

  const handleSuggestFix = async (entry: LogEntry, index: number) => {
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

    let surroundingCode = '';
    const editor = editorRef.current;
    if (editor && entry.line) {
      const model = editor.getModel();
      if (model) {
        const start = Math.max(1, entry.line - 3);
        const end = Math.min(model.getLineCount(), entry.line + 3);
        surroundingCode = model.getValueInRange({
          startLineNumber: start,
          startColumn: 1,
          endLineNumber: end,
          endColumn: model.getLineMaxColumn(end),
        });
      }
    }

    const result = await suggestLatexFix({
      errorMessage: entry.message,
      errorLine: entry.line,
      errorFile: entry.file,
      detail: entry.detail,
      surroundingCode,
    });

    setFixState((prev) => ({
      ...prev,
      [key]: { loading: false, result },
    }));
  };

  const handleApplyFix = (entry: LogEntry, fix: AiErrorFixResult, index: number) => {
    const key = getEntryKey(entry, index);
    const editor = editorRef.current;
    if (!editor) {
      toast.error('Editor not ready to apply fix');
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const targetLine = entry.line || fix.startLine || 1;
    const startLine = Math.max(1, Math.min(targetLine, model.getLineCount()));
    const endLine = Math.max(startLine, Math.min(fix.endLine || startLine, model.getLineCount()));
    const maxCol = model.getLineMaxColumn(endLine);

    let rangeToReplace = {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: maxCol,
    };

    if (fix.originalSnippet && fix.originalSnippet.trim()) {
      const matches = model.findMatches(fix.originalSnippet.trim(), false, false, false, null, true);
      if (matches.length > 0) {
        const closest = matches.reduce((prev, curr) => {
          return Math.abs(curr.range.startLineNumber - startLine) < Math.abs(prev.range.startLineNumber - startLine)
            ? curr
            : prev;
        });
        rangeToReplace = closest.range;
      }
    }

    editor.executeEdits('ai-error-assist', [
      {
        range: rangeToReplace,
        text: fix.fixedSnippet,
        forceMoveMarkers: true,
      },
    ]);
    editor.revealLineInCenter(startLine);
    editor.focus();

    setFixState((prev) => ({
      ...prev,
      [key]: { ...prev[key], applied: true },
    }));

    toast.success('Fix applied! Recompiling...');

    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else if (compileRef.current) {
      compileRef.current();
    }
  };

  const handleEntryClick = (entry: LogEntry) => {
    if (entry.line) {
      if (onJumpToError) {
        onJumpToError(entry.file, entry.line);
      } else if (scrollToLineRef.current) {
        scrollToLineRef.current(entry.line, 'error');
      }
    }
  };

  const countOf = (key: LogTab) => {
    if (key === 'errors') return parsed.errors.length;
    if (key === 'warnings') return parsed.warnings.length;
    if (key === 'badboxes') return parsed.badBoxes.length;
    return null;
  };

  const badgeClass = (key: LogTab) => {
    const n = countOf(key);
    if (n === null) return '';
    const inactive = 'bg-muted text-muted-foreground';
    if (key === 'errors') {
      if (n > 0) return 'bg-destructive text-destructive-foreground';
      return inactive;
    }
    if (key === 'warnings') {
      if (n > 0) return 'bg-warning text-warning-foreground';
      return inactive;
    }
    if (key === 'badboxes') {
      if (n > 0) return 'bg-primary text-primary-foreground';
      return inactive;
    }
    return '';
  };

  const tabs: { key: LogTab; label: string }[] = [
    { key: 'errors', label: 'Errors' },
    { key: 'warnings', label: 'Warnings' },
    { key: 'badboxes', label: 'Bad Boxes' },
    { key: 'raw', label: 'Raw Log' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col border-t border-border h-[280px]">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted shrink-0">
        <div className="flex overflow-x-auto" role="tablist" aria-label="Log tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 shrink-0 transition-colors outline-none',
                activeTab === tab.key
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-foreground hover:bg-muted',
              )}
            >
              {tab.label}
              {countOf(tab.key) !== null && (
                <span
                  className={cn(
                    'px-1 min-w-4 text-center rounded-full text-xs font-medium tabular-nums leading-4',
                    badgeClass(tab.key),
                  )}
                >
                  {countOf(tab.key)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pr-2">
          {onClearCacheAndCompile && (
            <button
              type="button"
              onClick={onClearCacheAndCompile}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded transition-colors cursor-pointer"
              title="Clear compilation cache and recompile from scratch"
            >
              <RefreshCw className="size-3 shrink-0" />
              <span>Clear Cache & Recompile</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close log panel"
            className="p-1.5 text-foreground hover:bg-muted rounded transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'raw' && (
          <pre className="p-3 text-foreground/90 font-mono text-xs whitespace-pre-wrap leading-5">
            {log}
          </pre>
        )}
        {activeTab === 'errors' &&
          (parsed.errors.length === 0 ? (
            <LogEmpty text="No errors" />
          ) : (
            parsed.errors.map((e, i) => {
              const key = getEntryKey(e, i);
              const state = fixState[key];
              return (
                <EntryRow
                  key={i}
                  type="error"
                  entry={e}
                  onClick={() => handleEntryClick(e)}
                  onSuggestFix={() => handleSuggestFix(e, i)}
                  isFixLoading={state?.loading}
                  fixResult={state?.result}
                  isFixApplied={state?.applied}
                  onApplyFix={(_entry, fix) => handleApplyFix(e, fix, i)}
                />
              );
            })
          ))}
        {activeTab === 'warnings' &&
          (parsed.warnings.length === 0 ? (
            <LogEmpty text="No warnings" />
          ) : (
            parsed.warnings.map((e, i) => (
              <EntryRow
                key={i}
                type="warning"
                entry={e}
                onClick={() => handleEntryClick(e)}
              />
            ))
          ))}
        {activeTab === 'badboxes' &&
          (parsed.badBoxes.length === 0 ? (
            <LogEmpty text="No bad boxes" />
          ) : (
            parsed.badBoxes.map((e, i) => (
              <EntryRow
                key={i}
                type="badbox"
                entry={e}
                onClick={() => handleEntryClick(e)}
              />
            ))
          ))}
      </div>
    </div>
  );
}

export const LogPanel = Logs;
