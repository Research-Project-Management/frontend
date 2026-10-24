'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  Bot,
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
    // Close AI fix if open
    if (fixResult && onSuggestFix) {
      onSuggestFix(entry);
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

  const hasExpandableContent = Boolean(
    activeExplanation ||
    entry.explanation ||
    entry.code ||
    entry.rawExcerpt ||
    (entry.detail && !/^[@^~.?!\s]+$/.test(entry.detail) && entry.detail.length > 1) ||
    fixResult ||
    isFixLoading
  );
  const isExpanded = isExplainOpen || Boolean(fixResult || isFixLoading);

  return (
    <div
      id={id}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2.5 border-b border-border last:border-b-0 transition-colors',
        isClickable && 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/70 outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-inset',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExplain();
          }}
          className={cn(
            'size-5 -ml-1 mt-0.5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-transform cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border shrink-0',
            !hasExpandableContent && 'opacity-40 cursor-default hover:bg-transparent hover:text-muted-foreground'
          )}
          disabled={!hasExpandableContent}
        >
          <ChevronRight
            className={cn(
              'size-3.5 transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        </button>
        <div className="flex-1 min-w-0 max-w-[72ch]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2">
            <p className="text-foreground font-mono text-xs leading-snug break-words min-w-0 max-w-[70ch]">
              {entry.message}
            </p>
            <div className="flex items-center flex-wrap gap-1.5 shrink-0">
              {entry.quickFix && onApplyQuickFix ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyQuickFix(entry, entry.quickFix!);
                  }}
                  className="min-h-[26px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors relative after:absolute after:-inset-1 after:content-['']"
                  title={`Quick fix: ${entry.quickFix.description}`}
                >
                  <Bot className="size-3" />
                  <span>Quick fix</span>
                </button>
              ) : type === 'error' && onSuggestFix ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestFix(entry);
                  }}
                  className={cn(
                    'min-h-[26px] flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai relative after:absolute after:-inset-1 after:content-[\'\']',
                    fixResult || isFixLoading
                      ? 'bg-ai/15 text-ai border-ai/30 font-semibold'
                      : 'bg-ai/10 text-ai border-ai/25 hover:bg-ai/20'
                  )}
                  title="Ask AI Error Assist to explain and fix this LaTeX error"
                >
                  {isFixLoading && (
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-ai" />
                  )}
                  <span>{fixResult ? 'Hide fix' : 'Fix with AI'}</span>
                </button>
              ) : null}

              {(entry.explanation || entry.code) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleExplain();
                  }}
                  className={cn(
                    'min-h-[26px] flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium shrink-0 transition-colors border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1 after:content-[\'\']',
                    isExplainOpen
                      ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                      : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  )}
                  title="View LaTeX error explanation"
                >
                  {isExplaining && (
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-primary" />
                  )}
                  <span>{isExplainOpen ? 'Hide guide' : 'Guide'}</span>
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
                  aria-label={`Go to line ${entry.line}${entry.file ? ` in ${entry.file}` : ''}`}
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
            <pre className="mt-1.5 px-2.5 py-1 border border-border/60 rounded-sm bg-muted/20 font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed select-text overflow-x-auto max-w-[70ch]">
              {entry.rawExcerpt}
            </pre>
          ) : (
            entry.detail && !/^[@^~.?!\s]+$/.test(entry.detail) && entry.detail.length > 1 && (
              <p className="text-muted-foreground text-xs mt-0.5 truncate font-mono max-w-[70ch]">{entry.detail}</p>
            )
          )}
        </div>
      </div>

      {/* LaTeX Error Guide Expansion Panel (Only if no AI fix active) */}
      {isExplainOpen && activeExplanation && !fixResult && !isFixLoading && (
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
