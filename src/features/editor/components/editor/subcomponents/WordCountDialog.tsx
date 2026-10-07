'use client';

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
import { fetchWordCount, type WordCountResponse } from '@/features/editor/services/compiler.service';

export interface TeXcountStats {
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  headers: number;
  floats: number;
  mathInlines: number;
  mathDisplayed: number;
  totalWords?: number;
  charactersWithSpaces?: number;
  charactersNoSpaces?: number;
}

export interface WordCountDialogFile {
  id: string;
  title: string;
  content?: unknown;
}

export interface WordCountDialogProps {
  open: boolean;
  onClose: () => void;
  content?: string;
  selectedText?: string;
  activeFileName?: string;
  projectFiles?: WordCountDialogFile[];
  onInsertSnippet?: (snippet: string) => void;
}

export type WordCountScope = 'document' | 'project' | 'selection';

function extractFileText(file?: WordCountDialogFile): string {
  if (!file || !file.content) return '';
  if (typeof file.content === 'string') return file.content;
  if (typeof file.content === 'object') {
    const obj = file.content as Record<string, unknown>;
    if (typeof obj.source === 'string') return obj.source;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
  }
  return '';
}

/**
 * Client-side fallback LaTeX word counter matching TeXcount extraction rules
 */
export function countLatexWords(latex: string): TeXcountStats {
  if (!latex || !latex.trim()) {
    return {
      wordsInText: 0,
      wordsInHeaders: 0,
      wordsInCaptions: 0,
      headers: 0,
      floats: 0,
      mathInlines: 0,
      mathDisplayed: 0,
      totalWords: 0,
      charactersWithSpaces: 0,
      charactersNoSpaces: 0,
    };
  }

  // 1. Remove TeXcount ignored regions: %TC:ignore ... %TC:endignore
  let text = latex.replace(/%TC:ignore[\s\S]*?%TC:endignore/gi, '');

  // 2. Remove comments (% to end of line, avoiding escaped \%)
  text = text.replace(/(^|[^\\])%.*$/gm, '$1');

  // 3. Count math inlines: $...$ or \(...\)
  const mathInlineMatches = text.match(/\$(?:\\\$|[^\$])+\$/g) || [];
  const mathParenMatches = text.match(/\\\([\s\S]*?\\\)/g) || [];
  const mathInlines = mathInlineMatches.length + mathParenMatches.length;

  // 4. Count math displayed: \[...\], $$, or equation/align/gather/multline/flalign/alignat environments
  const mathBracketMatches = text.match(/\\\[[\s\S]*?\\\]/g) || [];
  const mathDoubleDollarMatches = text.match(/\$\$[\s\S]*?\$\$/g) || [];
  const mathEnvMatches =
    text.match(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || [];
  const mathDisplayed = mathBracketMatches.length + mathDoubleDollarMatches.length + mathEnvMatches.length;

  // 5. Count floats / tables / figures
  const floatMatches =
    text.match(/\\begin\{(figure|table|algorithm|table\*|figure\*)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || [];
  const floats = floatMatches.length;

  // 6. Count headers & words in headers: \section{...}, \subsection{...}, \chapter{...}, etc.
  const headerRegex = /\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]+)\}/g;
  let headers = 0;
  let wordsInHeaders = 0;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    headers++;
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInHeaders += words.length;
  }

  // 7. Count captions & footnotes (words outside text)
  const captionRegex = /\\caption\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let wordsInCaptions = 0;
  while ((match = captionRegex.exec(text)) !== null) {
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInCaptions += words.length;
  }

  const footnoteRegex = /\\footnote\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInCaptions += words.length;
  }

  // 8. Strip math, headers, captions, footnotes, floats, commands to calculate words in body text
  let bodyText = text;
  bodyText = bodyText.replace(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\\[[\s\S]*?\\\]/g, ' ');
  bodyText = bodyText.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  bodyText = bodyText.replace(/\$(?:\\\$|[^\$])+\$/g, ' ');
  bodyText = bodyText.replace(/\\\([\s\S]*?\\\)/g, ' ');
  bodyText = bodyText.replace(/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\caption\*?(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\footnote\*?(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\begin\{(figure|table|algorithm)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, '$1 ');
  bodyText = bodyText.replace(/[{}]/g, ' ');

  const bodyWords = bodyText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));

  const wordsInText = bodyWords.length;
  const totalWords = wordsInText + wordsInHeaders + wordsInCaptions;
  const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();
  const charactersWithSpaces = normalizedBody.length;
  const charactersNoSpaces = normalizedBody.replace(/\s/g, '').length;

  return {
    wordsInText,
    wordsInHeaders,
    wordsInCaptions,
    headers,
    floats,
    mathInlines,
    mathDisplayed,
    totalWords,
    charactersWithSpaces,
    charactersNoSpaces,
  };
}

export function WordCountDialog({
  open,
  onClose,
  content = '',
  selectedText = '',
  activeFileName = 'main.tex',
  projectFiles = [],
  onInsertSnippet,
}: WordCountDialogProps) {
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

  // Aggregate project content across all .tex files
  const projectTexFiles = useMemo(() => {
    if (!Array.isArray(projectFiles)) return [];
    return projectFiles.filter((f) => {
      const name = (f?.title || '').toLowerCase();
      return name.endsWith('.tex') || !name.includes('.');
    });
  }, [projectFiles]);

  const aggregatedProjectContent = useMemo(() => {
    if (projectTexFiles.length === 0) return content;
    return projectTexFiles
      .map((f) => extractFileText(f))
      .filter(Boolean)
      .join('\n\n');
  }, [projectTexFiles, content]);

  // Determine current active text based on selected scope
  const activeContent = useMemo(() => {
    switch (scope) {
      case 'selection':
        return selectedText;
      case 'project':
        return aggregatedProjectContent;
      case 'document':
      default:
        return content;
    }
  }, [scope, selectedText, aggregatedProjectContent, content]);

  // Fast local calculation (instant feedback)
  const localStats = useMemo(() => countLatexWords(activeContent), [activeContent]);

  // Backend CLSI analysis state
  const [serverStats, setServerStats] = useState<WordCountResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(false);

  // Per-file statistics for Project scope breakdown
  const perFileStats = useMemo(() => {
    if (scope !== 'project' || projectTexFiles.length <= 1) return [];
    return projectTexFiles.map((file) => {
      const fileText = extractFileText(file);
      const fileCount = countLatexWords(fileText);
      return {
        id: file.id,
        title: file.title || 'untitled.tex',
        words: fileCount.totalWords ?? (fileCount.wordsInText + fileCount.wordsInHeaders + fileCount.wordsInCaptions),
        headers: fileCount.headers,
        math: fileCount.mathInlines + fileCount.mathDisplayed,
      };
    });
  }, [scope, projectTexFiles]);

  // Recount trigger function
  const executeWordCount = useCallback(() => {
    if (!open || !activeContent || !activeContent.trim()) {
      setServerStats(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    fetchWordCount(activeContent)
      .then((res) => {
        if (active && res.success && res.stats) {
          setServerStats(res.stats);
        }
      })
      .catch((err) => {
        console.warn('[WordCountDialog] Server word count error, using local analysis:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, activeContent]);

  useEffect(() => {
    const cleanup = executeWordCount();
    return cleanup;
  }, [executeWordCount]);

  // Active merged stats (server prioritized, local fallback)
  const stats: TeXcountStats = useMemo(() => {
    if (serverStats) {
      const wordsInText = serverStats.wordsInText ?? 0;
      const wordsInHeaders = serverStats.wordsInHeaders ?? 0;
      const wordsInCaptions = serverStats.wordsInCaptions ?? 0;
      const totalWords =
        serverStats.totalWords ?? (wordsInText + wordsInHeaders + wordsInCaptions);

      return {
        wordsInText,
        wordsInHeaders,
        wordsInCaptions,
        headers: serverStats.headers ?? 0,
        floats: serverStats.floats ?? 0,
        mathInlines: serverStats.mathInlines ?? 0,
        mathDisplayed: serverStats.mathDisplayed ?? 0,
        totalWords,
        charactersWithSpaces:
          serverStats.charactersWithSpaces ?? localStats.charactersWithSpaces,
        charactersNoSpaces:
          serverStats.charactersNoSpaces ?? localStats.charactersNoSpaces,
      };
    }
    return localStats;
  }, [serverStats, localStats]);

  const totalWordsCount =
    stats.totalWords ??
    stats.wordsInText + stats.wordsInHeaders + stats.wordsInCaptions;

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
    [stats]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[480px] w-full p-0 gap-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-200 flex flex-col max-h-[85vh] select-none"
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
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
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
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all font-medium truncate"
              >
                <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{activeFileName || 'Document'}</span>
              </TabsTrigger>

              <TabsTrigger
                value="project"
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all font-medium"
              >
                <Files className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span>Project</span>
              </TabsTrigger>

              <TabsTrigger
                value="selection"
                disabled={!hasSelection}
                className="text-12 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all disabled:opacity-40 font-medium"
              >
                <MousePointer className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span>Selection</span>
                {hasSelection && (
                  <span className="size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none ml-0.5" />
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Body: Single Unified Source of Truth Table ─────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3 thin-scrollbar">
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

        {/* ── Dialog Footer (Only Close button, seamless background, no border) ── */}
        <DialogFooter className="px-6 pb-5 pt-3 bg-background flex items-center justify-end shrink-0 m-0 border-0">
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
