'use client';

/**
 * PdfFindBar.tsx
 *
 * Overleaf-parity floating in-document PDF search bar:
 * - Real-time query search across all compiled PDF pages
 * - Match counter (e.g. "3 of 12" / "No matches")
 * - Next / Previous navigation buttons with keyboard shortcuts
 * - Accessible focus trapping, Esc to dismiss
 * - Project design tokens (bg-popover, border-border, shadow-raised)
 */

import React, { useRef, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
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
    }
  };

  const hasQuery = Boolean(query.trim());

  return (
    <div
      role="search"
      aria-label="Find in PDF"
      className="absolute top-2 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 bg-popover/95 backdrop-blur-sm text-popover-foreground border border-border shadow-raised-200 rounded-lg text-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none"
    >
      <Search className="size-3.5 text-muted-foreground shrink-0" />

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document…"
        className="w-36 sm:w-48 h-6 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none font-normal"
      />

      {/* Match Status */}
      <div className="flex items-center min-w-[55px] justify-center text-center text-11 text-muted-foreground px-1 select-none">
        {isSearching ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : hasQuery && matchesCount === 0 ? (
          <span className="text-destructive font-medium text-11">No matches</span>
        ) : hasQuery && matchesCount > 0 ? (
          <span className="tabular-nums font-mono text-11">
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
        className="size-6 p-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
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
        className="size-6 p-0 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
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
