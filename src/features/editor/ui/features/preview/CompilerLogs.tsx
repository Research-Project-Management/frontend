'use client';

/**
 * CompilerLogs.tsx
 *
 * Canonical Overleaf-parity Compiler Logs & Output Files Panel (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/CompilerLogs.tsx`
 *
 * Capabilities:
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
  ChevronLeft,
  Trash2,
  Download,
  Check,
  Wand2,
  Loader2,
  Copy,
} from 'lucide-react';
import { useLogViewerActions, copySnippetToClipboard, fetchLogEntryExplanation } from './hooks/useLogViewerActions';
import { cn } from '@/shared/lib/utils';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';
import { PlaneErrorState, PlaneEmptyState } from '@/shared/components/ui';
import { usePageStore, useCompileStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import {
  suggestLatexFix,
  type AiErrorFixResult,
} from '@/features/editor/coordinators/services/ai-error-assist.service';
import {
  listAuxFiles,
  type AuxFileItem,
} from '@/features/editor/coordinators/services/compiler.service';
import {
  manuscriptService,
  type ErrorExplanationDto,
  type DiagnosticReportDto,
} from '@/features/editor/coordinators/services/manuscript.service';
import { CompileButton } from './CompileButton';

export interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
  code?: string;
  rawExcerpt?: string;
  explanation?: ErrorExplanationDto;
  quickFix?: {
    description: string;
    replacementText: string;
  };
}

export interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

const PARSED_LOG_CACHE_MAX = 5;
const parsedLogCache = new Map<string, ParsedLog>();

export function parseLatexLog(raw: string): ParsedLog {
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;

  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry, max: number = 300) => {
    if (arr.length >= max) return;
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
      const excerptLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cur = lines[j];
        if (cur.startsWith('!')) break;
        excerptLines.push(cur);
        const m = cur.match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          const rawDetail = m[2].trim();
          detail = rawDetail && !/^[@^~.?!\s]+$/.test(rawDetail) && rawDetail.length > 1 ? rawDetail : undefined;
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            if (lines[k] && !lines[k].startsWith('!')) {
              excerptLines.push(lines[k]);
            }
          }
          break;
        }
      }
      const rawExcerpt = excerptLines.filter((l) => l.trim().length > 0).join('\n');
      tryAdd(errors, { message, line: lineNum, detail, rawExcerpt: rawExcerpt || undefined });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      const excerptLines: string[] = [line];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j] && !lines[j].startsWith('!') && !lines[j].includes('Warning:')) {
          excerptLines.push(lines[j]);
        } else {
          break;
        }
      }
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
        rawExcerpt: excerptLines.join('\n'),
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

  const result: ParsedLog = { errors, warnings, badBoxes };
  if (parsedLogCache.size >= PARSED_LOG_CACHE_MAX) {
    const firstKey = parsedLogCache.keys().next().value;
    if (firstKey) parsedLogCache.delete(firstKey);
  }
  parsedLogCache.set(raw, result);

  return result;
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

const EntryRow = React.memo(function EntryRow({
  id,
  type,
  entry,
  onClick,
  onSuggestFix,
  isFixLoading,
  fixResult,
  isFixApplied,
  onApplyFix,
  onApplyQuickFix,
}: {
  id?: string;
  type: 'error' | 'warning' | 'badbox';
  entry: LogEntry;
  onClick?: () => void;
  onSuggestFix?: (entry: LogEntry) => void;
  isFixLoading?: boolean;
  fixResult?: AiErrorFixResult | null;
  isFixApplied?: boolean;
  onApplyFix?: (entry: LogEntry, fix: AiErrorFixResult) => void;
  onApplyQuickFix?: (entry: LogEntry, fix: { description: string; replacementText: string }) => void;
}) {
  const isClickable = Boolean(entry.line);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [fetchedExplanation, setFetchedExplanation] = useState<ErrorExplanationDto | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const activeExplanation = entry.explanation || fetchedExplanation;

  const handleToggleExplain = async () => {
    if (isExplainOpen) {
      setIsExplainOpen(false);
      return;
    }
    if (activeExplanation) {
      setIsExplainOpen(true);
      return;
    }
    setIsExplaining(true);
    try {
      const exp = await fetchLogEntryExplanation(entry);
      if (exp) {
        setFetchedExplanation(exp);
        setIsExplainOpen(true);
      }
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div
      id={id}
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
        isClickable && 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/70 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset',
      )}
    >
      <div className="flex items-start gap-2.5">
        {type === 'error' && <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />}
        {type === 'warning' && <AlertTriangle className="size-3.5 text-warning shrink-0 mt-0.5" />}
        {type === 'badbox' && <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground font-mono text-xs leading-snug break-words">
              {entry.message}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {entry.quickFix && onApplyQuickFix && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyQuickFix(entry, entry.quickFix!);
                  }}
                  className="flex items-center gap-1 text-11 px-2 py-0.5 rounded-md font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors"
                  title={`Quick fix: ${entry.quickFix.description}`}
                >
                  <Wand2 className="size-3" />
                  <span>Quick fix</span>
                </button>
              )}

              {(entry.explanation || entry.code || type === 'error') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleExplain();
                  }}
                  className={cn(
                    'flex items-center gap-1 text-11 px-2 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                    isExplainOpen
                      ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                      : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  )}
                  title="View LaTeX error explanation and remedies"
                >
                  {isExplaining && (
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-primary" />
                  )}
                  <span>{isExplainOpen ? 'Hide guide' : 'Explain'}</span>
                </button>
              )}

              {type === 'error' && onSuggestFix && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestFix(entry);
                  }}
                  className={cn(
                    'flex items-center gap-1 text-11 px-2 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                    fixResult || isFixLoading
                      ? 'bg-ai/15 text-ai border-ai/30 font-semibold'
                      : 'bg-ai/10 text-ai border-ai/25 hover:bg-ai/20'
                  )}
                  title="Ask AI Error Assist to explain and fix this LaTeX error"
                >
                  {isFixLoading && (
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-ai" />
                  )}
                  <span>{fixResult ? 'Hide fix' : 'Suggest fix'}</span>
                </button>
              )}
            </div>
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
          {entry.rawExcerpt ? (
            <div className="mt-1.5 p-2 rounded-md bg-muted/40 border border-border/40 font-mono text-11 text-muted-foreground whitespace-pre-wrap leading-relaxed select-text overflow-x-auto">
              {entry.rawExcerpt}
            </div>
          ) : (
            entry.detail && !/^[@^~.?!\s]+$/.test(entry.detail) && entry.detail.length > 1 && (
              <p className="text-muted-foreground text-xs mt-0.5 truncate">{entry.detail}</p>
            )
          )}
        </div>
      </div>

      {/* LaTeX Error Guide Expansion Card */}
      {isExplainOpen && activeExplanation && (
        <div
          role="region"
          aria-label="LaTeX Error Guide"
          onClick={(e) => e.stopPropagation()}
          className="ml-6 mt-2 p-3.5 rounded-md bg-muted/30 border border-border text-xs space-y-2.5 select-text"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-13 text-foreground tracking-tight">
              {activeExplanation.title || 'LaTeX Error Guide'}
            </h4>
          </div>

          {activeExplanation.explanation && (
            <p className="text-12 text-foreground/90 leading-relaxed font-normal">
              {activeExplanation.explanation}
            </p>
          )}

          {activeExplanation.commonCauses && activeExplanation.commonCauses.length > 0 && (
            <div className="space-y-1 pt-0.5">
              <span className="font-medium text-11 text-foreground/80">Common Causes:</span>
              <ul className="list-disc pl-4 space-y-1 text-11 text-muted-foreground">
                {activeExplanation.commonCauses.map((cause, cIdx) => (
                  <li key={cIdx}>{cause}</li>
                ))}
              </ul>
            </div>
          )}

          {activeExplanation.suggestedFix && (
            <div className="space-y-1 pt-0.5">
              <span className="font-medium text-11 text-foreground/80">Suggested Fix:</span>
              <p className="text-11 text-muted-foreground bg-background/60 p-2 rounded border border-border/60">
                {activeExplanation.suggestedFix}
              </p>
            </div>
          )}

          {activeExplanation.exampleSnippet && (
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-11 text-foreground/80">Example Snippet:</span>
                <button
                  type="button"
                  onClick={() => copySnippetToClipboard(activeExplanation.exampleSnippet)}
                  className="text-10 text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="size-3" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="font-mono text-11 bg-background p-2 rounded border border-border text-foreground overflow-x-auto">
                {activeExplanation.exampleSnippet}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* AI Error Assist Expansion Card */}
      {(isFixLoading || fixResult) && (
        <div
          role="region"
          aria-label="AI Error Assist"
          onClick={(e) => e.stopPropagation()}
          className="ml-6 mt-2 p-3.5 rounded-md bg-card border border-border text-xs space-y-2.5 select-text"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-13 text-foreground tracking-tight">
              AI Error Assist
            </h4>
            {fixResult && (
              <span
                className={cn(
                  'text-11 px-2 py-0.5 rounded-md font-medium capitalize border',
                  fixResult.confidence === 'high'
                    ? 'border-success/30 bg-success/10 text-success'
                    : fixResult.confidence === 'medium'
                    ? 'border-ai/30 bg-ai/10 text-ai'
                    : 'border-border bg-muted/60 text-muted-foreground'
                )}
              >
                {fixResult.confidence} confidence
              </span>
            )}
          </div>

          {isFixLoading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-ai shrink-0" />
              <span className="text-12">Analyzing LaTeX error and generating fix...</span>
            </div>
          ) : fixResult ? (
            <>
              <p className="text-13 text-foreground/85 leading-normal font-normal">
                {fixResult.explanation}
              </p>

              {/* Code Diff Preview */}
              {fixResult.fixedSnippet && (
                <div className="rounded-md border border-border bg-background overflow-hidden font-mono text-11 my-1.5">
                  {fixResult.originalSnippet &&
                  fixResult.originalSnippet !== fixResult.fixedSnippet &&
                  !fixResult.originalSnippet.startsWith('%') ? (
                    <>
                      <div className="bg-destructive/10 text-destructive px-3 py-1.5 border-b border-border/60 whitespace-pre-wrap leading-relaxed">
                        <span className="select-none font-semibold mr-2 text-destructive">-</span>
                        {fixResult.originalSnippet}
                      </div>
                      <div className="bg-success/10 text-success px-3 py-1.5 whitespace-pre-wrap leading-relaxed">
                        <span className="select-none font-semibold mr-2 text-success">+</span>
                        {fixResult.fixedSnippet}
                      </div>
                    </>
                  ) : (
                    <div className="bg-success/10 text-success px-3 py-1.5 whitespace-pre-wrap leading-relaxed">
                      <span className="select-none font-semibold mr-2 text-success">+</span>
                      {fixResult.fixedSnippet}
                    </div>
                  )}
                </div>
              )}

              {fixResult.fixedSnippet && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFixApplied}
                    onClick={() => onApplyFix?.(entry, fixResult)}
                    className={cn(
                      'h-8 px-3 rounded-md text-13 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      isFixApplied
                        ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed inline-flex items-center gap-1.5'
                        : 'bg-primary hover:bg-primary-hover text-primary-foreground'
                    )}
                  >
                    {isFixApplied ? (
                      <>
                        <Check className="size-3.5" />
                        <span>Applied & Recompiled</span>
                      </>
                    ) : (
                      <span>Apply suggestion</span>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});

export interface CompilerLogsProps {
  log: string;
  parsedLog?: ParsedLog;
  onClose: () => void;
  onJumpToError?: (file: string | undefined, line: number) => void;
  onClearCacheAndCompile?: () => void;
  onCompile?: () => void;
}

export type LogsProps = CompilerLogsProps;

export function CompilerLogs({
  log,
  parsedLog: externalParsedLog,
  onClose,
  onJumpToError,
  onClearCacheAndCompile,
  onCompile,
}: CompilerLogsProps) {
  const projectId = usePageStore((s) => s.projectId);
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const { engine } = useEditorInstance();
  const parsed = useMemo(
    () => externalParsedLog ?? parseLatexLog(log),
    [externalParsedLog, log],
  );

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRawLogsOpen, setIsRawLogsOpen] = useState(false);
  const [isOtherFilesOpen, setIsOtherFilesOpen] = useState(false);

  // Enriched Backend Diagnostics Report
  const [enrichedReport, setEnrichedReport] = useState<DiagnosticReportDto | null>(null);

  useEffect(() => {
    if (!log || !log.trim()) {
      setEnrichedReport(null);
      return;
    }
    let isSubscribed = true;
    manuscriptService.diagnostics.parseLog(log)
      .then((report) => {
        if (isSubscribed && report) {
          setEnrichedReport(report);
        }
      })
      .catch(() => {});
    return () => {
      isSubscribed = false;
    };
  }, [log]);

  const enrichEntry = useCallback(
    (e: LogEntry): LogEntry => {
      if (!enrichedReport?.items || enrichedReport.items.length === 0) return e;
      const match = enrichedReport.items.find((item) => {
        if (item.line && e.line && item.line === e.line) return true;
        if (
          e.message &&
          item.message &&
          (item.message.includes(e.message) || e.message.includes(item.message))
        )
          return true;
        return false;
      });
      if (!match) return e;
      return {
        ...e,
        file: match.file || e.file,
        code: match.code || e.code,
        explanation: match.explanation || e.explanation,
        quickFix: match.quickFix || e.quickFix,
      };
    },
    [enrichedReport],
  );

  const {
    applyQuickFix,
    applyAiFix,
    downloadFile,
    downloadAllArtifacts,
  } = useLogViewerActions({
    engine,
    projectId,
    onCompile,
    onClearCacheAndCompile,
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
  }, [engine, fixState, getEntryKey]);

  const handleApplyFix = useCallback((entry: LogEntry, fix: AiErrorFixResult, index: number) => {
    const key = getEntryKey(entry, index);
    applyAiFix(entry, fix, () => {
      setFixState((prev) => ({
        ...prev,
        [key]: { loading: false, applied: true, result: fix },
      }));
    });
  }, [applyAiFix, getEntryKey]);

  // Listen for editor:suggest-fix command from editor CodeMirror gutter or tooltip
  useEffect(() => {
    return editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
      const { error } = cmd;
      setActiveTab('errors');

      const idx = parsed.errors.findIndex(
        (e) =>
          (error.line && e.line === error.line) ||
          (error.message && (e.message.includes(error.message) || error.message.includes(e.message)))
      );

      const targetIdx = idx !== -1 ? idx : parsed.errors.length > 0 ? 0 : -1;
      if (targetIdx !== -1) {
        const entry = enrichEntry(parsed.errors[targetIdx]);
        handleSuggestFix(entry, targetIdx);
        setTimeout(() => {
          const el = document.getElementById(`log-entry-err-${targetIdx}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    });
  }, [parsed.errors, enrichEntry, handleSuggestFix]);

  const handleEntryClick = useCallback((entry: LogEntry) => {
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
  }, [onJumpToError]);

  const handleDownloadFile = (fileName: string) => {
    downloadFile(fileName);
  };

  const handleDownloadAll = () => {
    downloadAllArtifacts();
  };

  const totalLogsCount = parsed.errors.length + parsed.warnings.length + parsed.badBoxes.length;

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground select-none overflow-hidden">
      {/* ── Top Header Toolbar (Overleaf 1:1 Parity, Synchronized with Flux Design) ── */}
      <header className="h-10 px-3 bg-background border-b border-border flex items-center justify-between gap-2 shrink-0">
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
            className="h-7.5 px-2.5 flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground" />
            <span>Back to PDF</span>
          </button>
        </div>
      </header>

      {/* ── Filter Tabs (All logs, Errors, Warnings, Info) ── */}
      <nav
        role="tablist"
        aria-label="Log filter categories"
        className="h-9 px-3 bg-background border-b border-border flex items-center gap-4 shrink-0 overflow-x-auto no-scrollbar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
            activeTab === 'all'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>All logs</span>
          <span className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium bg-muted text-muted-foreground">
            {totalLogsCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'errors'}
          onClick={() => setActiveTab('errors')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
            activeTab === 'errors'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Errors</span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded-full text-11 font-mono font-semibold',
              parsed.errors.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground font-medium'
            )}
          >
            {parsed.errors.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'warnings'}
          onClick={() => setActiveTab('warnings')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
            activeTab === 'warnings'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Warnings</span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded-full text-11 font-mono font-semibold',
              parsed.warnings.length > 0 ? 'bg-warning/20 text-warning font-semibold' : 'bg-muted text-muted-foreground font-medium'
            )}
          >
            {parsed.warnings.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'info'}
          onClick={() => setActiveTab('info')}
          className={cn(
            'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
            activeTab === 'info'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          <span>Info</span>
          <span className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium bg-muted text-muted-foreground">
            {parsed.badBoxes.length}
          </span>
        </button>
      </nav>

      {/* ── Main Body ── */}
      {compileStatus === 'error' && parsed.errors.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-background">
          <PlaneErrorState
            title="Compilation failed"
            description="The LaTeX compiler encountered an error or terminated prematurely. Check the raw logs below to diagnose the issue."
            error={log ? new Error(log.slice(-1000)) : new Error('LaTeX engine failed to compile document.')}
          />
        </div>
      ) : activeTab === 'all' && totalLogsCount === 0 && !log ? (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-background">
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
                <span>Back to PDF preview</span>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
          {/* Compilation Error Banner (when errors exist) */}
          {parsed.errors.length > 0 && (activeTab === 'all' || activeTab === 'errors') && (
            <div className="flex items-center justify-between p-3 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <span className="font-medium text-foreground">
                  <strong className="text-destructive font-semibold">
                    {parsed.errors.length} compilation {parsed.errors.length === 1 ? 'error' : 'errors'}
                  </strong>{' '}
                  detected in this build
                </span>
              </div>
              {parsed.errors.some((e) => e.line) && (
                <button
                  type="button"
                  onClick={() => {
                    const first = parsed.errors.find((e) => e.line);
                    if (first) handleEntryClick(first);
                  }}
                  className="px-2.5 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                >
                  Jump to first error
                </button>
              )}
            </div>
          )}

          {/* Collapsible: > Raw logs accordion (Overleaf 1:1 Match) */}
          <div id="raw-latex-logs" className="rounded-md border border-border bg-background overflow-hidden">
            <button
              type="button"
              aria-expanded={isRawLogsOpen}
              aria-controls="raw-latex-logs-content"
              onClick={() => setIsRawLogsOpen((prev) => !prev)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left font-medium text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronRight
                className={cn('size-3.5 text-muted-foreground transition-transform duration-150', isRawLogsOpen && 'rotate-90')}
              />
              <span>Raw logs</span>
            </button>
            {isRawLogsOpen && (
              <pre id="raw-latex-logs-content" className="p-3 border-t border-border/60 bg-muted/20 font-mono text-11 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text">
                {log || 'No compilation logs recorded yet.'}
              </pre>
            )}
          </div>

          {/* Diagnostic Entries List */}
          <div className="rounded-md border border-border bg-background overflow-hidden">
            {/* Errors */}
            {(activeTab === 'all' || activeTab === 'errors') &&
              parsed.errors.map((e, i) => {
                const enriched = enrichEntry(e);
                const key = getEntryKey(enriched, i);
                const state = fixState[key];
                return (
                  <EntryRow
                    key={`err-${i}`}
                    id={`log-entry-err-${i}`}
                    type="error"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onSuggestFix={() => handleSuggestFix(enriched, i)}
                    isFixLoading={state?.loading}
                    fixResult={state?.result}
                    isFixApplied={state?.applied}
                    onApplyFix={(_entry, fix) => handleApplyFix(enriched, fix, i)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

            {/* Warnings */}
            {(activeTab === 'all' || activeTab === 'warnings') &&
              parsed.warnings.map((e, i) => {
                const enriched = enrichEntry(e);
                return (
                  <EntryRow
                    key={`warn-${i}`}
                    type="warning"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

            {/* Info / Bad boxes */}
            {(activeTab === 'all' || activeTab === 'info') &&
              parsed.badBoxes.map((e, i) => {
                const enriched = enrichEntry(e);
                return (
                  <EntryRow
                    key={`info-${i}`}
                    type="badbox"
                    entry={enriched}
                    onClick={() => handleEntryClick(enriched)}
                    onApplyQuickFix={handleApplyQuickFix}
                  />
                );
              })}

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
            {activeTab === 'warnings' && parsed.warnings.length === 0 && (
              <div className="py-10">
                <PlaneEmptyState
                  variant="review"
                  isCompact
                  title="No compilation warnings"
                  description="No layout warnings or unresolved reference warnings found."
                />
              </div>
            )}
            {activeTab === 'info' && parsed.badBoxes.length === 0 && (
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
      <footer className="h-10 px-3 bg-background border-t border-border flex items-center justify-between shrink-0 select-none">
        {/* Left: Clear cached files button */}
        <button
          type="button"
          onClick={onClearCacheAndCompile}
          className="h-7.5 px-2.5 rounded-md bg-muted/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border hover:border-destructive/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-destructive"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Clear cached files</span>
        </button>

        {/* Right: Other logs and files Popover */}
        <Popover open={isOtherFilesOpen} onOpenChange={setIsOtherFilesOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-7.5 px-2.5 rounded-md bg-background hover:bg-muted border border-border text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                  className="w-full text-left px-3.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-between group outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  <span>{file}</span>
                  <Download className="size-3 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadAll}
              className="w-full px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted border-t border-border bg-muted/20 transition-colors cursor-pointer flex items-center justify-between outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span>Download all ({outputFiles.length})</span>
              <Download className="size-3.5 text-muted-foreground" />
            </button>
          </PopoverContent>
        </Popover>
      </footer>
    </div>
  );
}

export const Logs = CompilerLogs;
export const LogPanel = CompilerLogs;
export default CompilerLogs;
