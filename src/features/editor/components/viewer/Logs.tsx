'use client';

/**
 * Logs.tsx
 *
 * Overleaf-parity Compiler Logs & Output Files Panel (1:1 UI/UX Match):
 * - Top Header: [Recompile ▾] + [Back to PDF] button
 * - Filter Tabs: All logs (count), Errors (count), Warnings (count), Info (count)
 * - Collapsible: > Raw logs accordion
 * - Error entries with AI Error Assist (suggest & apply fixes directly)
 * - Bottom Bar:
 *   - [🗑️ Clear cached files] (Red pill button)
 *   - [Other logs and files ▴] (Popover with output.aux, output.log, synctex, etc. + Download all)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronUp,
  Trash2,
  Download,
  Check,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import {
  suggestLatexFix,
  type AiErrorFixResult,
} from '@/features/editor/services/ai-error-assist.service';
import {
  listAuxFiles,
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
  type AuxFileItem,
} from '@/features/editor/services/compiler.service';
import { CompileButton } from '../../sub-features/compiler/components/CompileButton';

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
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
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
    if (/^(Overfull|Underfull)\s*\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines?\s+(\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  return { errors, warnings, badBoxes };
}

type TabType = 'all' | 'errors' | 'warnings' | 'info';

const DEFAULT_OUTPUT_FILES = [
  'output.aux',
  'output.chktex',
  'output.log',
  'output.pdfxref',
  'output.stderr',
  'output.stdout',
  'output.synctex.gz',
];

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
        'flex flex-col gap-1.5 px-3 py-2.5 border-b border-border last:border-b-0 transition-colors',
        isClickable && 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/70 focus-visible:outline-none',
      )}
    >
      <div className="flex items-start gap-2.5">
        {type === 'error' && <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />}
        {type === 'warning' && <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />}
        {type === 'badbox' && <Info className="size-3.5 text-sky-500 shrink-0 mt-0.5" />}
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
                  'flex items-center gap-1 text-10 px-2 py-0.5 rounded-sm font-medium shrink-0 transition-colors border cursor-pointer',
                  fixResult || isFixLoading
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/20'
                )}
                title="Ask AI Error Assist to explain and fix this LaTeX error"
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
              {entry.file && <span className="text-foreground/80 font-medium">{entry.file}</span>}
              {entry.file && entry.line !== undefined && <span> · </span>}
              {entry.line !== undefined && (
                <span className={cn(isClickable && 'underline underline-offset-2 decoration-primary/40 hover:text-primary')}>
                  Line {entry.line}
                </span>
              )}
            </p>
          )}
          {entry.detail && (
            <p className="text-muted-foreground text-xs mt-0.5 truncate">{entry.detail}</p>
          )}
        </div>
      </div>

      {/* AI Error Assist Expansion Card */}
      {(isFixLoading || fixResult) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="ml-6 mt-1.5 p-3 rounded-md bg-muted/40 border border-border shadow-2xs text-xs space-y-2 select-text"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
              <span>AI Error Assist</span>
            </div>
            {fixResult && (
              <span className="text-10 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium capitalize">
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
              <div className="rounded-md border border-border bg-background overflow-hidden font-mono text-11 my-1.5">
                {fixResult.originalSnippet && (
                  <div className="bg-destructive/10 text-destructive px-2.5 py-1.5 border-b border-border/60 whitespace-pre-wrap">
                    <span className="select-none font-bold mr-2 text-destructive">-</span>
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
                      ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                      : 'bg-primary hover:bg-primary-hover text-primary-foreground shadow-2xs'
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

export interface LogsProps {
  log: string;
  onClose: () => void;
  onJumpToError?: (file: string | undefined, line: number) => void;
  onClearCacheAndCompile?: () => void;
  onCompile?: () => void;
}

export default function Logs({
  log,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
  onCompile,
}: LogsProps) {
  const { projectId } = usePageStore();
  const { engine } = useEditorInstance();
  const parsed = useMemo(() => parseLatexLog(log), [log]);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRawLogsOpen, setIsRawLogsOpen] = useState(false);
  const [isOtherFilesOpen, setIsOtherFilesOpen] = useState(false);

  // Auxiliary files list
  const [auxFiles, setAuxFiles] = useState<AuxFileItem[]>([]);
  useEffect(() => {
    if (projectId) {
      listAuxFiles(projectId)
        .then((files) => setAuxFiles(files))
        .catch(() => {});
    }
  }, [projectId]);

  const outputFiles = useMemo(() => {
    if (auxFiles && auxFiles.length > 0) {
      const names = auxFiles.map((f) => f.name);
      return Array.from(new Set([...names, ...DEFAULT_OUTPUT_FILES]));
    }
    return DEFAULT_OUTPUT_FILES;
  }, [auxFiles]);

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
    if (engine && entry.line) {
      const lines = engine.getContent().split('\n');
      const start = Math.max(0, entry.line - 4);
      const end = Math.min(lines.length, entry.line + 3);
      surroundingCode = lines.slice(start, end).join('\n');
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
    if (!engine) {
      toast.error('Editor not ready to apply fix');
      return;
    }

    const fullContent = engine.getContent();
    if (fix.originalSnippet && fix.originalSnippet.trim()) {
      const next = fullContent.replace(fix.originalSnippet.trim(), fix.fixedSnippet);
      if (next !== fullContent) {
        engine.setContent(next);
        engine.focus();
        setFixState((prev) => ({
          ...prev,
          [key]: { loading: false, applied: true, result: fix },
        }));
        toast.success('Fix applied! Recompiling...');
        if (onClearCacheAndCompile) onClearCacheAndCompile();
        else if (onCompile) onCompile();
        return;
      }
    }

    const lines = fullContent.split('\n');
    const targetLine = Math.max(1, Math.min(entry.line || fix.startLine || 1, lines.length));
    lines[targetLine - 1] = fix.fixedSnippet;
    engine.setContent(lines.join('\n'));
    engine.focus();

    setFixState((prev) => ({
      ...prev,
      [key]: { loading: false, applied: true, result: fix },
    }));
    toast.success('Fix applied! Recompiling...');
    if (onClearCacheAndCompile) onClearCacheAndCompile();
    else if (onCompile) onCompile();
  };

  const handleEntryClick = (entry: LogEntry) => {
    if (entry.line) {
      if (onJumpToError) {
        onJumpToError(entry.file, entry.line);
      } else {
        editorCommandBus.dispatch({
          type: 'editor:jump-to-line',
          line: entry.line,
          highlight: 'error',
        });
      }
    }
  };

  const handleDownloadFile = (fileName: string) => {
    if (fileName === 'output.log' && log) {
      const blob = new Blob([log], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'output.log';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (projectId) {
      const url = downloadAuxFileUrl(projectId, fileName);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } else {
      toast.info(`Downloading ${fileName}...`);
    }
  };

  const handleDownloadAll = () => {
    if (projectId) {
      const url = downloadAllArtifactsZipUrl(projectId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-output-files.zip`;
      a.click();
    } else {
      // Fallback: download log as blob
      handleDownloadFile('output.log');
    }
  };

  const totalLogsCount = parsed.errors.length + parsed.warnings.length + parsed.badBoxes.length;

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground select-none overflow-hidden">
      {/* ── Top Header Toolbar (Overleaf 1:1 Parity) ── */}
      <header className="h-10 px-3 bg-muted/60 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {onCompile && (
            <CompileButton
              onCompile={onCompile}
              onClearCacheAndCompile={onClearCacheAndCompile}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to PDF"
            className="px-3 py-1 rounded-full border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer select-none shadow-2xs"
          >
            Back to PDF
          </button>
        </div>
      </header>

      {/* ── Filter Tabs (All logs, Errors, Warnings, Info) ── */}
      <nav aria-label="Log categories" className="h-9 px-3 bg-background border-b border-border flex items-center gap-4 shrink-0 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2',
            activeTab === 'all'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>All logs</span>
          <span className="px-1.5 py-0.2 rounded-full text-10 font-mono font-medium bg-muted text-muted-foreground">
            {totalLogsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('errors')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2',
            activeTab === 'errors'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Errors</span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded-full text-10 font-mono font-bold',
              parsed.errors.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground font-medium'
            )}
          >
            {parsed.errors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('warnings')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2',
            activeTab === 'warnings'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Warnings</span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded-full text-10 font-mono font-bold',
              parsed.warnings.length > 0 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground font-medium'
            )}
          >
            {parsed.warnings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2',
            activeTab === 'info'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Info</span>
          <span className="px-1.5 py-0.2 rounded-full text-10 font-mono font-medium bg-muted text-muted-foreground">
            {parsed.badBoxes.length}
          </span>
        </button>
      </nav>

      {/* ── Main Body ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
        {/* Collapsible: > Raw logs accordion (Overleaf 1:1 Match) */}
        <div className="rounded-md border border-border bg-card overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsRawLogsOpen((prev) => !prev)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left font-medium text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
          >
            <ChevronRight
              className={cn('size-3.5 text-muted-foreground transition-transform duration-150', isRawLogsOpen && 'rotate-90')}
            />
            <span>Raw logs</span>
          </button>
          {isRawLogsOpen && (
            <div className="p-3 border-t border-border bg-muted/30">
              <pre className="font-mono text-11 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text">
                {log || 'No compilation logs recorded yet.'}
              </pre>
            </div>
          )}
        </div>

        {/* Diagnostic Entries List */}
        <div className="rounded-md border border-border bg-card overflow-hidden shadow-2xs">
          {/* Errors */}
          {(activeTab === 'all' || activeTab === 'errors') &&
            parsed.errors.map((e, i) => {
              const key = getEntryKey(e, i);
              const state = fixState[key];
              return (
                <EntryRow
                  key={`err-${i}`}
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
            })}

          {/* Warnings */}
          {(activeTab === 'all' || activeTab === 'warnings') &&
            parsed.warnings.map((e, i) => (
              <EntryRow
                key={`warn-${i}`}
                type="warning"
                entry={e}
                onClick={() => handleEntryClick(e)}
              />
            ))}

          {/* Info / Bad boxes */}
          {(activeTab === 'all' || activeTab === 'info') &&
            parsed.badBoxes.map((e, i) => (
              <EntryRow
                key={`info-${i}`}
                type="badbox"
                entry={e}
                onClick={() => handleEntryClick(e)}
              />
            ))}

          {/* Empty States */}
          {activeTab === 'errors' && parsed.errors.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground font-medium">
              No errors found in this compilation.
            </div>
          )}
          {activeTab === 'warnings' && parsed.warnings.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground font-medium">
              No warnings found in this compilation.
            </div>
          )}
          {activeTab === 'info' && parsed.badBoxes.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground font-medium">
              No bad boxes or layout warnings.
            </div>
          )}
          {activeTab === 'all' && totalLogsCount === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground font-medium">
              No logs, errors, or warnings reported.
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Action Bar (Clear cached files & Other logs and files) ── */}
      <footer className="h-11 px-3 bg-muted/60 border-t border-border flex items-center justify-between shrink-0 select-none">
        {/* Left: Clear cached files button */}
        <button
          type="button"
          onClick={onClearCacheAndCompile}
          className="h-7.5 px-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none shadow-2xs"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Clear cached files</span>
        </button>

        {/* Right: Other logs and files Popover */}
        <Popover open={isOtherFilesOpen} onOpenChange={setIsOtherFilesOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-7.5 px-3 rounded-full bg-background hover:bg-muted border border-border text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none shadow-2xs"
            >
              <span>Other logs and files</span>
              <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-64 p-0 bg-popover border border-border text-popover-foreground shadow-raised-300 rounded-md overflow-hidden select-none"
          >
            <div className="px-3.5 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/40">
              Download other output files
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {outputFiles.map((file) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => handleDownloadFile(file)}
                  className="w-full text-left px-3.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span>{file}</span>
                  <Download className="size-3 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
            </div>
            <div
              onClick={handleDownloadAll}
              className="px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted border-t border-border bg-muted/20 transition-colors cursor-pointer flex items-center justify-between"
            >
              <span>Download all ({outputFiles.length})</span>
              <Download className="size-3.5 text-muted-foreground" />
            </div>
          </PopoverContent>
        </Popover>
      </footer>
    </div>
  );
}

export const LogPanel = Logs;
