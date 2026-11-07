'use client';

/**
 * WordCountModal.tsx
 *
 * Canonical Detailed Word Count and Document Metrics Modal (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/WordCountModal.tsx`
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Loader2,
  FileText,
  Files,
  MousePointer,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fetchWordCount, type WordCountResponse } from '@/features/editor/sdk/pages.service';
import {
  countLatexWords,
  EMPTY_TEXCOUNT_STATS,
  type TeXcountStats,
  type LatexWordCountResult,
  type WordCountSection,
} from '@/features/editor/domain/document/word-count';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';

export { countLatexWords, type TeXcountStats, type LatexWordCountResult, type WordCountSection };

export interface WordCountModalFile {
  id: string;
  title: string;
  content?: unknown;
}

export interface WordCountModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  content?: string;
  selectedText?: string;
  activeFileName?: string;
  projectFiles?: WordCountModalFile[];
  onInsertSnippet?: (snippet: string) => void;
}

export type WordCountScope = 'document' | 'project' | 'selection';

const wordCountResultCache = new Map<string, WordCountResponse['stats']>();
const wordCountInFlightCache = new Map<string, Promise<WordCountResponse>>();

function hashWordCountInput(
  scope: WordCountScope,
  projectId: string | undefined,
  includeBib: boolean,
  filename: string,
  source: string,
  filesMap?: Record<string, string>,
): string {
  let h = 2166136261;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let filesHash = 0;
  if (filesMap) {
    for (const [k, v] of Object.entries(filesMap)) {
      for (let i = 0; i < k.length; i++) {
        filesHash = Math.imul(filesHash ^ k.charCodeAt(i), 16777619);
      }
      for (let i = 0; i < v.length; i++) {
        filesHash = Math.imul(filesHash ^ v.charCodeAt(i), 16777619);
      }
    }
  }
  return `${scope}|${projectId ?? ''}|${includeBib ? 1 : 0}|${filename}|${source.length}:${h >>> 0}|${filesHash >>> 0}`;
}

export function WordCountModal({
  open,
  onClose,
  projectId,
  content = '',
  selectedText = '',
  activeFileName = 'main.tex',
  projectFiles = [],
}: WordCountModalProps) {
  const hasSelection = Boolean(selectedText && selectedText.trim().length > 0);

  // Initialize scope based on active selection presence
  const [scope, setScope] = useState<WordCountScope>(() =>
    hasSelection ? 'selection' : 'document'
  );

  // Update scope when selection appears while dialog opens
  useEffect(() => {
    if (open) {
      if (hasSelection) {
        setScope('selection');
      } else {
        setScope('document');
      }
    }
  }, [open, hasSelection]);

  // Build project files map for backend project-scope word count
  const projectFilesMap = useMemo(() => {
    if (!Array.isArray(projectFiles) || projectFiles.length === 0) return undefined;
    const map: Record<string, string> = {};
    for (const f of projectFiles) {
      const name = f?.title || '';
      if (!name) continue;
      const lower = name.toLowerCase();
      if (lower.endsWith('.tex') || lower.endsWith('.bbl') || !lower.includes('.')) {
        map[name] = extractDocumentContentString(f?.content);
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [projectFiles]);

  // Determine current active text based on selected scope
  const activeContent = useMemo(() => {
    switch (scope) {
      case 'selection':
        return selectedText;
      case 'project':
        return '';
      case 'document':
      default:
        return content;
    }
  }, [scope, selectedText, content]);

  const [includeBib, setIncludeBib] = useState<boolean>(() => /%TC:incbib\b/i.test(content));

  // Sync if %TC:incbib appears in document
  useEffect(() => {
    if (/%TC:incbib\b/i.test(content)) {
      setIncludeBib(true);
    }
  }, [content]);

  // Backend CLSI analysis state
  const [serverStats, setServerStats] = useState<WordCountResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(false);

  // Per-file statistics returned from backend for Project scope breakdown
  const perFileStats = useMemo(() => {
    if (scope !== 'project') return [];
    return serverStats?.perFileStats ?? [];
  }, [scope, serverStats]);

  // Recount trigger function calling backend word-count authority with content-hash deduplication
  const executeWordCount = useCallback(
    (forceRefresh = false) => {
      if (!open) {
        setServerStats(null);
        setLoading(false);
        return;
      }

      if (scope !== 'project' && (!activeContent || !activeContent.trim())) {
        setServerStats(null);
        setLoading(false);
        return;
      }

      const sourceParam = scope === 'project' ? '' : activeContent;
      const filenameParam =
        scope === 'selection'
          ? 'selection.tex'
          : activeFileName || 'main.tex';
      const targetProjectId = scope === 'project' ? projectId : undefined;
      const filesForScope = scope === 'project' && projectFilesMap ? projectFilesMap : undefined;

      const cacheKey = hashWordCountInput(
        scope,
        targetProjectId,
        includeBib,
        filenameParam,
        sourceParam,
        filesForScope,
      );

      if (!forceRefresh) {
        const cached = wordCountResultCache.get(cacheKey);
        if (cached) {
          setServerStats(cached);
          setLoading(false);
          return;
        }
      }

      let active = true;
      setLoading(true);

      let reqPromise = !forceRefresh ? wordCountInFlightCache.get(cacheKey) : undefined;
      if (!reqPromise) {
        reqPromise = fetchWordCount(sourceParam, targetProjectId, {
          includeBib,
          filename: filenameParam,
          ...(filesForScope ? { files: filesForScope } : {}),
        }).finally(() => {
          wordCountInFlightCache.delete(cacheKey);
        });
        wordCountInFlightCache.set(cacheKey, reqPromise);
      }

      reqPromise
        .then((res) => {
          if (res.success && res.stats) {
            if (wordCountResultCache.size >= 32) {
              const oldestKey = wordCountResultCache.keys().next().value;
              if (oldestKey !== undefined) {
                wordCountResultCache.delete(oldestKey);
              }
            }
            wordCountResultCache.set(cacheKey, res.stats);
            if (active) {
              setServerStats(res.stats);
            }
          }
        })
        .catch((err) => {
          console.warn('[WordCountDialog] Server word count error:', err);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    },
    [open, scope, activeContent, activeFileName, projectId, includeBib, projectFilesMap],
  );

  useEffect(() => {
    const cleanup = executeWordCount();
    return cleanup;
  }, [executeWordCount]);

  // Active stats from backend authority
  const stats: TeXcountStats = useMemo(() => {
    if (serverStats) {
      const wordsInText = serverStats.wordsInText ?? 0;
      const wordsInHeaders = serverStats.wordsInHeaders ?? 0;
      const wordsInCaptions = serverStats.wordsInCaptions ?? 0;
      const wordsInBibliography = serverStats.wordsInBibliography ?? 0;
      const totalWords =
        serverStats.totalWords ??
        (wordsInText +
          wordsInHeaders +
          wordsInCaptions +
          (includeBib ? wordsInBibliography : 0));

      return {
        wordsInText,
        wordsInHeaders,
        wordsInCaptions,
        wordsInBibliography,
        headers: serverStats.headers ?? 0,
        floats: serverStats.floats ?? 0,
        mathInlines: serverStats.mathInlines ?? 0,
        mathDisplayed: serverStats.mathDisplayed ?? 0,
        totalWords,
        charactersWithSpaces: serverStats.charactersWithSpaces ?? 0,
        charactersNoSpaces: serverStats.charactersNoSpaces ?? 0,
        cjkCharacters: serverStats.cjkCharacters ?? 0,
        readingTimeMinutes: serverStats.readingTimeMinutes ?? 0,
        sections: serverStats.sections ?? [],
        perFileStats: serverStats.perFileStats ?? [],
      };
    }
    return EMPTY_TEXCOUNT_STATS;
  }, [serverStats, includeBib]);

  const totalWordsCount =
    stats.totalWords ??
    stats.wordsInText + stats.wordsInHeaders + stats.wordsInCaptions + (stats.wordsInBibliography ?? 0);

  // Unified single source of truth metrics
  const metricRows = useMemo(
    () => [
      {
        label: 'Words in text',
        description: 'Body paragraphs, lists, and main narrative text',
        value: stats.wordsInText,
      },
      {
        label: 'Words in headers',
        description: 'Headings, sections, chapters, and titles',
        value: stats.wordsInHeaders,
      },
      {
        label: 'Words outside text',
        description: 'Figure and table captions, subcaptions, and footnotes',
        value: stats.wordsInCaptions,
      },
      ...(stats.wordsInBibliography !== undefined && (stats.wordsInBibliography > 0 || includeBib)
        ? [
            {
              label: 'Words in bibliography',
              description: 'References and citations (%TC:incbib)',
              value: stats.wordsInBibliography,
            },
          ]
        : []),
      {
        label: 'Characters without spaces',
        description: 'Total characters excluding spaces',
        value: stats.charactersNoSpaces ?? 0,
      },
      {
        label: 'Characters with spaces',
        description: 'Total characters including spaces',
        value: stats.charactersWithSpaces ?? 0,
      },
      {
        label: 'Number of headers',
        description: 'Section, chapter, and paragraph headings',
        value: stats.headers,
      },
      {
        label: 'Number of floats/tables/figures',
        description: 'Floating environments including figures, tables, and algorithms',
        value: stats.floats,
      },
      {
        label: 'Number of math inlines',
        description: 'Inline formulas and mathematical expressions',
        value: stats.mathInlines,
      },
      {
        label: 'Number of math displayed',
        description: 'Display equations, numbered blocks, and align environments',
        value: stats.mathDisplayed,
      },
    ],
    [stats, includeBib]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:w-full sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-md border border-border bg-background shadow-raised-200 flex flex-col max-h-[85vh] select-none"
      >
        {/* ── Dialog Header (Only Title with live indicator, and Close Icon) ─── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 bg-background shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Word Count
            </DialogTitle>
            {loading && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
            )}
          </div>
          <DialogClose asChild>
            <button
              type="button"
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          Official academic word count and structural analysis based on TeXcount.
        </DialogDescription>

        {/* ── Scope Selector Tabs (Fixed Toolbar) ────────────────────────── */}
        <div className="px-6 pt-2 pb-2 shrink-0 bg-background">
          <Tabs
            value={scope}
            onValueChange={(val) => setScope(val as WordCountScope)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 h-8 p-0.5 bg-muted/60 border border-border/50 rounded-md">
              <TabsTrigger
                value="document"
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-colors font-medium truncate"
              >
                <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{activeFileName || 'Document'}</span>
              </TabsTrigger>

              <TabsTrigger
                value="project"
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-colors font-medium"
              >
                <Files className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span>Project</span>
              </TabsTrigger>

              <TabsTrigger
                value="selection"
                disabled={!hasSelection}
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-colors disabled:opacity-40 font-medium"
              >
                <MousePointer className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span>Selection</span>
                {hasSelection && (
                  <span className="size-1.5 rounded-full bg-primary ml-0.5" />
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Body: Single Unified Source of Truth Table ─────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-3 thin-scrollbar">
          <div className="w-full">
            <table className="w-full text-13 border-collapse" aria-label="Word count metrics">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-11 font-medium">
                  <th scope="col" className="py-2 px-1 text-left font-medium">Metric</th>
                  <th scope="col" className="py-2 px-1 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* Total words primary row */}
                <tr className="bg-muted/30 font-medium">
                  <td className="py-2 px-1 text-foreground font-semibold">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center gap-1.5 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-foreground rounded-sm"
                            tabIndex={0}
                            role="button"
                            aria-label="Total words info"
                          >
                            Total words
                            <Info className="size-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" strokeWidth={1.5} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs max-w-xs">
                          Sum of words in text, headers, captions, and footnotes
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="py-2 px-1 text-right font-mono font-semibold text-foreground tabular-nums">
                    {totalWordsCount.toLocaleString()}
                  </td>
                </tr>

                {/* Subcount and structure rows */}
                {metricRows.map((row) => (
                  <tr
                    key={row.label}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-1.5 px-1 text-foreground font-normal">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center gap-1.5 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-foreground rounded-sm"
                              tabIndex={0}
                              role="button"
                              aria-label={`${row.label} info`}
                            >
                              {row.label}
                              <Info className="size-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" strokeWidth={1.5} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs max-w-xs">
                            {row.description}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono font-normal text-muted-foreground tabular-nums">
                      {row.value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Multi-File Project Breakdown (Only for Project scope when > 1 file) ── */}
          {scope === 'project' && perFileStats.length > 1 && (
            <div className="pt-2">
              <div className="text-11 font-medium text-muted-foreground pb-1 px-1 flex items-center justify-between">
                <span>File Breakdown</span>
                <span className="font-mono text-10">{perFileStats.length} files</span>
              </div>
              <div className="divide-y divide-border/60 max-h-36 overflow-y-auto thin-scrollbar">
                {perFileStats.map((item) => (
                  <div
                    key={item.id}
                    className="py-1.5 px-1 text-12 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  >
                    <span className="truncate text-foreground max-w-[240px] font-mono text-11">
                      {item.title}
                    </span>
                    <span className="font-mono text-11 text-muted-foreground tabular-nums">
                      {item.words.toLocaleString()} words
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Dialog Footer with %TC:incbib option and Close button ── */}
        <DialogFooter className="px-6 pb-5 pt-3 bg-background flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 shrink-0 m-0 border-0">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-bib-count"
              checked={includeBib}
              onCheckedChange={(c) => setIncludeBib(Boolean(c))}
            />
            <label
              htmlFor="include-bib-count"
              className="text-11 font-medium text-muted-foreground cursor-pointer select-none min-h-[28px] flex items-center"
            >
              Include bibliography (%TC:incbib)
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WordCountModal;

