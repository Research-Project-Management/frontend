'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { LogEntry } from '@/features/editor/domain/types/compiler.types';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';

export interface LogAiFixPanelProps {
  entry: LogEntry;
  isFixLoading?: boolean;
  fixResult?: AiErrorFixResult | null;
  isFixApplied?: boolean;
  onApplyFix?: (entry: LogEntry, fix: AiErrorFixResult) => void;
}

export function LogAiFixPanel({
  entry,
  isFixLoading,
  fixResult,
  isFixApplied,
  onApplyFix,
}: LogAiFixPanelProps) {
  if (!isFixLoading && !fixResult) return null;

  return (
    <div
      role="region"
      aria-label="AI Error Assist"
      onClick={(e) => e.stopPropagation()}
      className="ml-6 mt-2 px-3 py-2 border border-ai/30 bg-ai-subtle/40 rounded-md text-xs space-y-2.5 select-text"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-13 text-foreground tracking-tight">
          AI Error Assist
        </h4>
        {fixResult && (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-md font-medium capitalize border',
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
          <span className="text-xs">Analyzing LaTeX error and generating fix...</span>
        </div>
      ) : fixResult ? (
        <>
          <p className="text-13 text-foreground/85 leading-normal font-normal">
            {fixResult.explanation}
          </p>

          {/* Code Diff Preview */}
          {fixResult.fixedSnippet && (
            <div className="rounded-md border border-border/70 overflow-hidden font-mono text-xs my-1.5">
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
                  'h-8 px-3 rounded-md text-13 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                  isFixApplied
                    ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed inline-flex items-center gap-1.5'
                    : 'bg-ai hover:bg-ai-hover text-ai-foreground'
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
  );
}
