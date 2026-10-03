'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchWordCount, type WordCountResponse } from '@/features/editor/services/compiler.service';

export interface TeXcountStats {
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  headers: number;
  floats: number;
  mathInlines: number;
  mathDisplayed: number;
}

interface WordCountDialogProps {
  open: boolean;
  onClose: () => void;
  content: string;
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

  // 4. Count math displayed: \[...\], $$, or equation/align/gather/multline environments
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

  // 7. Count captions & words in captions: \caption{...}
  const captionRegex = /\\caption\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let wordsInCaptions = 0;
  while ((match = captionRegex.exec(text)) !== null) {
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInCaptions += words.length;
  }

  // 8. Strip math, headers, captions, floats, commands to calculate words in body text
  let bodyText = text;
  bodyText = bodyText.replace(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\\[[\s\S]*?\\\]/g, ' ');
  bodyText = bodyText.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  bodyText = bodyText.replace(/\$(?:\\\$|[^\$])+\$/g, ' ');
  bodyText = bodyText.replace(/\\\([\s\S]*?\\\)/g, ' ');
  bodyText = bodyText.replace(/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\caption\*?(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\begin\{(figure|table|algorithm)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, '$1 ');
  bodyText = bodyText.replace(/[{}]/g, ' ');

  const bodyWords = bodyText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));

  return {
    wordsInText: bodyWords.length,
    wordsInHeaders,
    wordsInCaptions,
    headers,
    floats,
    mathInlines,
    mathDisplayed,
  };
}

export function WordCountDialog({
  open,
  onClose,
  content,
}: WordCountDialogProps) {
  const localStats = useMemo(() => countLatexWords(content), [content]);
  const [serverStats, setServerStats] = useState<WordCountResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !content || !content.trim()) {
      setServerStats(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetchWordCount(content)
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
  }, [open, content]);

  const stats: TeXcountStats = useMemo(() => {
    if (serverStats) {
      return {
        wordsInText: serverStats.wordsInText ?? 0,
        wordsInHeaders: serverStats.wordsInHeaders ?? 0,
        wordsInCaptions: serverStats.wordsInCaptions ?? 0,
        headers: serverStats.headers ?? 0,
        floats: serverStats.floats ?? 0,
        mathInlines: serverStats.mathInlines ?? 0,
        mathDisplayed: serverStats.mathDisplayed ?? 0,
      };
    }
    return localStats;
  }, [serverStats, localStats]);

  const rows = [
    { label: 'Words in text', value: stats.wordsInText },
    { label: 'Words in headers', value: stats.wordsInHeaders },
    { label: 'Words outside text (captions, etc.)', value: stats.wordsInCaptions },
    { label: 'Number of headers', value: stats.headers },
    { label: 'Number of floats/tables/figures', value: stats.floats },
    { label: 'Number of math inlines', value: stats.mathInlines },
    { label: 'Number of math displayed', value: stats.mathDisplayed },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full p-6 gap-4 bg-background border border-border shadow-raised-300 rounded-lg select-none">
        {/* ── Official Overleaf Header ──────────────────────────────────────── */}
        <DialogHeader className="pb-2 border-b border-border/70">
          <DialogTitle className="text-base font-semibold text-foreground">
            Word Count
          </DialogTitle>
          <DialogDescription className="sr-only">
            Document word count statistics generated by TeXcount
          </DialogDescription>
        </DialogHeader>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        {loading && !serverStats ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="text-xs">Counting words…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Official 7-Row TeXcount Table */}
            <table className="w-full text-xs border-collapse">
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.label}
                    className={`border-b border-border/40 ${
                      idx % 2 === 1 ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-foreground font-normal">
                      {row.label}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-medium text-foreground tabular-nums">
                      {row.value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Explanatory Note (Overleaf 1:1) */}
            <div className="pt-2 border-t border-border/60 text-11 text-muted-foreground space-y-1.5 leading-relaxed">
              <p>
                Note: Word count is an estimate provided by the{' '}
                <span className="font-medium text-foreground">TeXcount</span> utility. Words in headers, captions, and formulas are counted separately.
              </p>
              <p>
                To exclude specific sections, wrap them with{' '}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-10 text-foreground border border-border/50">
                  %TC:ignore
                </code>{' '}
                and{' '}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-10 text-foreground border border-border/50">
                  %TC:endignore
                </code>.
              </p>
              <div className="pt-0.5">
                <a
                  href="https://docs.overleaf.com/writing-and-editing/using-word-count"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-11"
                >
                  Learn more about using word count
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Dialog Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
