'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CornerDownLeft,
  Wand2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fetchLogEntryExplanation } from '@/features/editor/subsystems/compiler/ui/hooks/useLogViewerActions';
import { LogExplanationPanel } from './LogExplanationPanel';
import { LogAiFixPanel } from './LogAiFixPanel';
import type { LogEntry, ErrorExplanationDto } from '@/features/editor/domain/types/compiler.types';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';

export interface CompilerLogEntryRowProps {
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
}

export const CompilerLogEntryRow = React.memo(function CompilerLogEntryRow({
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
}: CompilerLogEntryRowProps) {
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
      onClick={isClickable ? onClick : undefined}
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
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2">
            <p className="text-foreground font-mono text-xs leading-snug break-words min-w-0">
              {entry.message}
            </p>
            <div className="flex items-center flex-wrap gap-1.5 shrink-0">
              {entry.line !== undefined && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                  }}
                  aria-label={`Go to line ${entry.line}`}
                  className="min-h-[28px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium text-foreground bg-muted hover:bg-muted/80 border border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors shrink-0 relative after:absolute after:-inset-1 after:content-['']"
                  title={`Go to line ${entry.line}${entry.file ? ` in ${entry.file}` : ''}`}
                >
                  <CornerDownLeft className="size-3 text-muted-foreground" />
                  <span>Line {entry.line}</span>
                </button>
              )}

              {entry.quickFix && onApplyQuickFix && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyQuickFix(entry, entry.quickFix!);
                  }}
                  className="min-h-[28px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors relative after:absolute after:-inset-1 after:content-['']"
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
                    'min-h-[28px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative after:absolute after:-inset-1 after:content-[\'\']',
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
                    'min-h-[28px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai relative after:absolute after:-inset-1 after:content-[\'\']',
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                  }}
                  className={cn(
                    isClickable && 'underline underline-offset-2 decoration-primary/40 hover:text-primary cursor-pointer text-xs font-mono border-none bg-transparent p-0 text-left'
                  )}
                >
                  Line {entry.line}
                </button>
              )}
            </p>
          )}
          {entry.rawExcerpt ? (
            <pre className="mt-1.5 pl-3 py-1 border-l border-border/70 font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed select-text overflow-x-auto bg-transparent">
              {entry.rawExcerpt}
            </pre>
          ) : (
            entry.detail && !/^[@^~.?!\s]+$/.test(entry.detail) && entry.detail.length > 1 && (
              <p className="text-muted-foreground text-xs mt-0.5 truncate font-mono">{entry.detail}</p>
            )
          )}
        </div>
      </div>

      {/* LaTeX Error Guide Expansion Panel */}
      {isExplainOpen && activeExplanation && (
        <LogExplanationPanel explanation={activeExplanation} />
      )}

      {/* AI Error Assist Expansion Panel */}
      {(isFixLoading || fixResult) && (
        <LogAiFixPanel
          entry={entry}
          isFixLoading={isFixLoading}
          fixResult={fixResult}
          isFixApplied={isFixApplied}
          onApplyFix={onApplyFix}
        />
      )}
    </div>
  );
});
