'use client';

/**
 * EditorSearchPanel.tsx
 *
 * Dedicated In-Editor Find & Replace Bar (Overleaf 1:1 Parity):
 * - "Search for" input with in-field toggles: [Aa] (Match Case), [.*] (Regex), [W] (Whole Word)
 * - Navigation: Previous match (^), Next match (v), Toggle Replace mode, Close (X)
 * - "Replace with" input with "Replace" and "Replace All" actions
 * - Real-time match highlight via CodeMirror @codemirror/search engine
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  ArrowRightLeft,
  Search,
} from 'lucide-react';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface EditorSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialReplaceOpen?: boolean;
}

export const EditorSearchPanel: React.FC<EditorSearchPanelProps> = ({
  isOpen,
  onClose,
  initialReplaceOpen = true,
}) => {
  const { engine } = useEditorInstance();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(initialReplaceOpen);
  const [matchCount, setMatchCount] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Sync query to CodeMirror engine
  const updateQuery = useCallback(
    (search: string, replace: string, cs: boolean, re: boolean, ww: boolean) => {
      if (!engine) return;

      if (!search) {
        engine.clearSearch?.();
        setMatchCount({ current: 0, total: 0 });
        return;
      }

      engine.setSearchQuery?.({
        search,
        replace,
        caseSensitive: cs,
        regexp: re,
        wholeWord: ww,
      });

      if (engine.getSearchMatchesCount) {
        const counts = engine.getSearchMatchesCount({
          search,
          caseSensitive: cs,
          regexp: re,
          wholeWord: ww,
        });
        setMatchCount(counts);
      }
    },
    [engine],
  );

  // When search params change, re-query
  useEffect(() => {
    if (!isOpen) return;
    updateQuery(searchTerm, replaceTerm, caseSensitive, isRegex, wholeWord);
  }, [isOpen, searchTerm, replaceTerm, caseSensitive, isRegex, wholeWord, updateQuery]);

  // Focus and populate selection on open
  useEffect(() => {
    if (isOpen) {
      const selected = engine?.getSelectedText?.();
      if (selected && !selected.includes('\n') && selected.length < 100) {
        setSearchTerm(selected);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    } else {
      engine?.clearSearch?.();
      setMatchCount({ current: 0, total: 0 });
    }
  }, [isOpen, engine]);

  const handleNext = useCallback(() => {
    if (!engine) return;
    engine.findNext?.();
    if (searchTerm && engine.getSearchMatchesCount) {
      setMatchCount(
        engine.getSearchMatchesCount({
          search: searchTerm,
          caseSensitive,
          regexp: isRegex,
          wholeWord,
        }),
      );
    }
  }, [engine, searchTerm, caseSensitive, isRegex, wholeWord]);

  const handlePrevious = useCallback(() => {
    if (!engine) return;
    engine.findPrevious?.();
    if (searchTerm && engine.getSearchMatchesCount) {
      setMatchCount(
        engine.getSearchMatchesCount({
          search: searchTerm,
          caseSensitive,
          regexp: isRegex,
          wholeWord,
        }),
      );
    }
  }, [engine, searchTerm, caseSensitive, isRegex, wholeWord]);

  const handleReplace = useCallback(() => {
    if (!engine) return;
    engine.replaceNext?.();
    if (searchTerm && engine.getSearchMatchesCount) {
      setMatchCount(
        engine.getSearchMatchesCount({
          search: searchTerm,
          caseSensitive,
          regexp: isRegex,
          wholeWord,
        }),
      );
    }
  }, [engine, searchTerm, caseSensitive, isRegex, wholeWord]);

  const handleReplaceAll = useCallback(() => {
    if (!engine) return;
    const countBefore = matchCount.total;
    engine.replaceAll?.();
    toast.success(
      countBefore > 0
        ? `Replaced ${countBefore} occurrence${countBefore > 1 ? 's' : ''}`
        : 'Replaced all occurrences',
    );
    if (searchTerm && engine.getSearchMatchesCount) {
      setMatchCount(
        engine.getSearchMatchesCount({
          search: searchTerm,
          caseSensitive,
          regexp: isRegex,
          wholeWord,
        }),
      );
    }
  }, [engine, matchCount.total, searchTerm, caseSensitive, isRegex, wholeWord]);

  const handleClose = useCallback(() => {
    engine?.clearSearch?.();
    onClose();
    engine?.focus?.();
  }, [engine, onClose]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      setCaseSensitive((prev) => !prev);
    } else if (e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      setIsRegex((prev) => !prev);
    } else if (e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      setWholeWord((prev) => !prev);
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleReplace();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="search"
      aria-label="Search and Replace"
      className={cn(
        'w-full border-t z-30 select-none transition-colors duration-150',
        'bg-background text-foreground border-border shadow-raised-200',
        'px-3.5 py-2.5 space-y-2',
      )}
    >
      {/* ── Row 1: Search for input & navigation ── */}
      <div className="flex items-center gap-2">
        {/* Main Search Input Box with embedded toggles */}
        <div className="relative flex-1 min-w-0 flex items-center bg-muted/60 rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary px-2.5 h-8 transition-colors">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search for"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0 font-mono tracking-tight"
            aria-label="Search for"
          />

          {/* Matches counter */}
          {searchTerm && (
            <span
              className={cn(
                'text-11 font-mono shrink-0 mr-2 select-none',
                matchCount.total > 0 ? 'text-muted-foreground' : 'text-destructive',
              )}
            >
              {matchCount.total > 0
                ? `${matchCount.current} of ${matchCount.total}`
                : 'No results'}
            </span>
          )}

          {/* In-field Toggles: [Aa] [.*] [W] */}
          <div className="flex items-center gap-0.5 shrink-0 pl-1.5 border-l border-border">
            {/* Match Case */}
            <button
              type="button"
              onClick={() => setCaseSensitive((prev) => !prev)}
              className={cn(
                'px-1.5 py-0.5 rounded-sm text-11 font-mono font-medium transition-colors cursor-pointer select-none leading-tight outline-none focus-visible:ring-1 focus-visible:ring-primary',
                caseSensitive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-none'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              title="Match Case (Alt+C)"
              aria-label="Match Case"
              aria-pressed={caseSensitive}
            >
              Aa
            </button>

            {/* Regex */}
            <button
              type="button"
              onClick={() => setIsRegex((prev) => !prev)}
              className={cn(
                'px-1.5 py-0.5 rounded-sm text-11 font-mono font-medium transition-colors cursor-pointer select-none leading-tight outline-none focus-visible:ring-1 focus-visible:ring-primary',
                isRegex
                  ? 'bg-primary text-primary-foreground font-semibold shadow-none'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              title="Use Regular Expression (Alt+R)"
              aria-label="Use Regular Expression"
              aria-pressed={isRegex}
            >
              .*
            </button>

            {/* Whole Word */}
            <button
              type="button"
              onClick={() => setWholeWord((prev) => !prev)}
              className={cn(
                'px-1.5 py-0.5 rounded-sm text-11 font-mono font-medium transition-colors cursor-pointer select-none leading-tight outline-none focus-visible:ring-1 focus-visible:ring-primary',
                wholeWord
                  ? 'bg-primary text-primary-foreground font-semibold shadow-none'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              title="Match Whole Word (Alt+W)"
              aria-label="Match Whole Word"
              aria-pressed={wholeWord}
            >
              W
            </button>
          </div>
        </div>

        {/* Action buttons: Prev, Next, Toggle Replace, Close */}
        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {/* Previous Match */}
          <button
            type="button"
            onClick={handlePrevious}
            className="flex size-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Previous Match (Shift+Enter)"
            aria-label="Previous Match"
          >
            <ChevronUp className="size-4 shrink-0" />
          </button>

          {/* Next Match */}
          <button
            type="button"
            onClick={handleNext}
            className="flex size-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Next Match (Enter)"
            aria-label="Next Match"
          >
            <ChevronDown className="size-4 shrink-0" />
          </button>

          {/* Toggle Replace row */}
          <button
            type="button"
            onClick={() => setShowReplace((prev) => !prev)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              showReplace
                ? 'bg-primary/20 text-primary'
                : 'hover:bg-muted hover:text-foreground',
            )}
            title="Toggle Replace Mode"
            aria-label="Toggle Replace"
            aria-expanded={showReplace}
          >
            <ArrowRightLeft className="size-3.5 shrink-0" />
          </button>

          {/* Close Panel */}
          <button
            type="button"
            onClick={handleClose}
            className="relative flex size-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors cursor-pointer ml-1 outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-['']"
            title="Close (Escape)"
            aria-label="Close search"
          >
            <X className="size-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Row 2: Replace with input & actions ── */}
      {showReplace && (
        <div className="flex items-center gap-2">
          {/* Replace Input Box */}
          <div className="relative flex-1 min-w-0 flex items-center bg-muted/60 rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary px-2.5 h-8 transition-colors">
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="Replace with"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0 font-mono tracking-tight"
              aria-label="Replace with"
            />
          </div>

          {/* Replace Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReplace}
              className="px-3 h-7 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              className="px-3 h-7 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorSearchPanel;
