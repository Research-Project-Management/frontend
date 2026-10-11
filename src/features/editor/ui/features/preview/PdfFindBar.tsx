/**
 * PdfFindBar.tsx
 *
 * Floating in-document PDF search bar (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfFindBar.tsx`
 *
 * Real-time query search across all compiled PDF pages:
 * - Match counter (e.g. "3 of 12" / "No matches" / "Invalid regex")
 * - Next / Previous navigation buttons with keyboard shortcuts
 * - Case Sensitive (Alt+C), Whole Word (Alt+W), and Regex (Alt+R) toggles
 * - Accessible focus trapping, Esc to dismiss
 */

'use client';

import React, { useRef, useEffect } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  CaseSensitive,
  WholeWord,
  Regex,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface PdfFindBarProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (val: string) => void;
  matchesCount: number;
  currentMatchIndex: number;
  isSearching: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  caseSensitive?: boolean;
  onToggleCaseSensitive?: () => void;
  wholeWord?: boolean;
  onToggleWholeWord?: () => void;
  useRegex?: boolean;
  onToggleRegex?: () => void;
  isRegexError?: boolean;
}

export const PdfFindBar = React.memo(function PdfFindBar({
  isOpen,
  query,
  onQueryChange,
  matchesCount,
  currentMatchIndex,
  isSearching,
  onNext,
  onPrev,
  onClose,
  caseSensitive = false,
  onToggleCaseSensitive,
  wholeWord = false,
  onToggleWholeWord,
  useRegex = false,
  onToggleRegex,
  isRegexError = false,
}: PdfFindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      onToggleCaseSensitive?.();
    } else if (e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      onToggleWholeWord?.();
    } else if (e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      onToggleRegex?.();
    }
  };

  const hasQuery = Boolean(query.trim());

  return (
    <div
      role="search"
      aria-label="Find in PDF"
      className="absolute top-2 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 bg-popover/95 backdrop-blur-sm text-popover-foreground border border-border shadow-overlay rounded-md text-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none"
    >
      <Search className="size-3.5 text-muted-foreground shrink-0" />

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document…"
        className="w-36 sm:w-44 h-6 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none font-normal"
      />

      {/* Filter Options: Case Sensitivity, Whole Word, Regex */}
      <div className="flex items-center gap-0.5 border-l border-border/60 pl-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCaseSensitive}
          title="Match Case (Alt+C)"
          aria-label="Match Case"
          aria-pressed={caseSensitive}
          className={cn(
            'size-5.5 p-0 rounded-sm cursor-pointer transition-colors',
            caseSensitive
              ? 'bg-primary/20 text-primary hover:bg-primary/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <CaseSensitive className="size-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleWholeWord}
          title="Match Whole Word (Alt+W)"
          aria-label="Match Whole Word"
          aria-pressed={wholeWord}
          className={cn(
            'size-5.5 p-0 rounded-sm cursor-pointer transition-colors',
            wholeWord
              ? 'bg-primary/20 text-primary hover:bg-primary/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <WholeWord className="size-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleRegex}
          title="Use Regular Expression (Alt+R)"
          aria-label="Use Regular Expression"
          aria-pressed={useRegex}
          className={cn(
            'size-5.5 p-0 rounded-sm cursor-pointer transition-colors',
            useRegex
              ? 'bg-primary/20 text-primary hover:bg-primary/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Regex className="size-3.5" />
        </Button>
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Match Status */}
      <div className="flex items-center min-w-[55px] justify-center text-center text-[11px] text-muted-foreground px-1 select-none">
        {isSearching ? (
          <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-muted-foreground" />
        ) : isRegexError ? (
          <span className="text-destructive font-medium text-[11px]">Invalid regex</span>
        ) : hasQuery && matchesCount === 0 ? (
          <span className="text-destructive font-medium text-[11px]">No matches</span>
        ) : hasQuery && matchesCount > 0 ? (
          <span className="tabular-nums font-mono text-[11px]">
            {currentMatchIndex + 1}/{matchesCount}
          </span>
        ) : null}
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Prev button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={matchesCount === 0}
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
        className="size-6 p-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
      >
        <ChevronUp className="size-3.5" />
      </Button>

      {/* Next button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={matchesCount === 0}
        title="Next match (Enter)"
        aria-label="Next match"
        className="size-6 p-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
      >
        <ChevronDown className="size-3.5" />
      </Button>

      {/* Close button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close find bar"
        className="size-6 p-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
});
export default PdfFindBar;
