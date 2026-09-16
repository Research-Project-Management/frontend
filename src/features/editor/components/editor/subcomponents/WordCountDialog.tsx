'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { FileText, Calculator, Sigma, AlignLeft, Hash, Heading, LayoutGrid, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchWordCount, type WordCountResponse } from '@/features/editor/services/compiler.service';

interface WordCountDialogProps {
  open: boolean;
  onClose: () => void;
  content: string;
}

export function countLatexWords(latex: string) {
  if (!latex) {
    return { words: 0, chars: 0, lines: 0, mathInline: 0, mathDisplay: 0 };
  }

  // 1. Remove comments (% to end of line)
  let clean = latex.replace(/%.*$/gm, '');

  // 2. Count math inline & display
  const mathInlineMatches = clean.match(/\$[^$]+\$/g) || [];
  const mathDisplayMatches =
    clean.match(/\\begin\{(equation|align|gather)\*?\}[\s\S]*?\\end\{\1\*?\}/g) ||
    [];

  // 3. Strip math out for text count
  clean = clean.replace(/\$[^$]+\$/g, ' ');
  clean = clean.replace(
    /\\begin\{(equation|align|gather)\*?\}[\s\S]*?\\end\{\1\*?\}/g,
    ' ',
  );

  // 4. Strip command names but keep braces content
  clean = clean.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, '$1 ');

  // 5. Calculate words and characters
  const rawWords = clean
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));

  const words = rawWords.length;
  const chars = clean.replace(/\s+/g, '').length;
  const lines = latex.split('\n').length;

  return {
    words,
    chars,
    lines,
    mathInline: mathInlineMatches.length,
    mathDisplay: mathDisplayMatches.length,
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
        console.warn('[WordCountDialog] Failed to fetch server word count:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, content]);

  const totalWords = serverStats
    ? (serverStats.wordsInText || 0) + (serverStats.wordsInHeaders || 0) + (serverStats.wordsInCaptions || 0)
    : localStats.words;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full p-5 gap-4 border border-border bg-background shadow-xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Calculator className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Word Count (TeXcount)
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                Official academic manuscript statistics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                <span>Analyzing…</span>
              </>
            ) : serverStats ? (
              <>
                <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                <span>TeXcount Verified</span>
              </>
            ) : (
              <span>Instant Estimation</span>
            )}
          </div>
        </DialogHeader>

        {/* Highlight Banner: Total Manuscript Words */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Manuscript Words
            </span>
            <div className="text-2xl font-bold font-mono text-primary mt-0.5">
              {totalWords.toLocaleString()}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <div>
              <span className="font-mono font-medium text-foreground">
                {(serverStats?.wordsInText ?? localStats.words).toLocaleString()}
              </span> in body
            </div>
            <div>
              <span className="font-mono font-medium text-foreground">
                {(serverStats?.wordsInHeaders ?? 0).toLocaleString()}
              </span> in headers
            </div>
            <div>
              <span className="font-mono font-medium text-foreground">
                {(serverStats?.wordsInCaptions ?? 0).toLocaleString()}
              </span> in captions
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Heading className="size-3 text-blue-500 shrink-0" /> Headings
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {(serverStats?.headers ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <LayoutGrid className="size-3 text-amber-500 shrink-0" /> Floats / Tables
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {(serverStats?.floats ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Sigma className="size-3 text-indigo-500 shrink-0" /> Math Formulas
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {(serverStats
                ? (serverStats.mathInlines ?? 0) + (serverStats.mathDisplayed ?? 0)
                : localStats.mathInline + localStats.mathDisplay
              ).toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {serverStats ? `${serverStats.mathInlines} in, ${serverStats.mathDisplayed} disp` : `${localStats.mathInline} in, ${localStats.mathDisplay} disp`}
            </span>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <AlignLeft className="size-3 text-emerald-500 shrink-0" /> Characters
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {localStats.chars.toLocaleString()}
            </span>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Hash className="size-3 text-purple-500 shrink-0" /> Lines
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {localStats.lines.toLocaleString()}
            </span>
          </div>

          <div className="bg-muted/40 p-2.5 rounded-md border border-border/50 flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <FileText className="size-3 text-rose-500 shrink-0" /> Body Words
            </span>
            <span className="text-base font-bold font-mono text-foreground mt-1">
              {(serverStats?.wordsInText ?? localStats.words).toLocaleString()}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
