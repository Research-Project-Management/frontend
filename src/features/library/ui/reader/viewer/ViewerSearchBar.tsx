'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DocumentFulltext } from '@/features/library/domain/types/reader.types';

export interface UseViewerSearchOptions {
  isSearchOpen: boolean;
  initialSearchQuery?: string;
  fulltext?: DocumentFulltext | null;
  numPages: number;
  pageRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  scrollToPage: (page: number) => void;
}

export function useViewerSearch({
  isSearchOpen,
  initialSearchQuery,
  fulltext,
  numPages,
  pageRefs,
  scrollToPage,
}: UseViewerSearchOptions) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery || '');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setDebouncedSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedSearchQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(trimmed);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen) {
      const timerId = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(timerId);
    } else {
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setCurrentMatchIdx(0);
    }
  }, [isSearchOpen]);

  const indexedSections = useMemo(() => {
    if (!fulltext?.sections) return null;
    return fulltext.sections.map((sec) => ({
      page: sec.page || 1,
      title: sec.title,
      lowerCorpus: [
        sec.title ? sec.title.toLowerCase() : '',
        ...(sec.paragraphs ? sec.paragraphs.map((p) => p.toLowerCase()) : []),
      ].join('\n'),
    }));
  }, [fulltext?.sections]);

  const searchMatches = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const list: { page: number; title?: string }[] = [];
    if (indexedSections) {
      for (const sec of indexedSections) {
        if (sec.lowerCorpus.includes(q)) {
          list.push({ page: sec.page, title: sec.title });
        }
      }
    }
    if (list.length === 0 && numPages > 0) {
      for (let p = 1; p <= numPages; p++) {
        const pEl = pageRefs.current.get(p);
        if (pEl && pEl.textContent?.toLowerCase().includes(q)) {
          list.push({ page: p });
        }
      }
    }
    return list;
  }, [debouncedSearchQuery, indexedSections, numPages, pageRefs]);

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(next);
    const m = searchMatches[next];
    if (m) scrollToPage(m.page);
  }, [searchMatches, currentMatchIdx, scrollToPage]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prev);
    const m = searchMatches[prev];
    if (m) scrollToPage(m.page);
  }, [searchMatches, currentMatchIdx, scrollToPage]);

  // Auto-scroll to first match when search query is active
  const lastScrolledQueryRef = useRef<string>('');
  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    if (q && q.length >= 2 && searchMatches.length > 0 && lastScrolledQueryRef.current !== q) {
      lastScrolledQueryRef.current = q;
      setCurrentMatchIdx(0);
      const first = searchMatches[0];
      if (first?.page) {
        scrollToPage(first.page);
      }
    }
  }, [debouncedSearchQuery, searchMatches, scrollToPage]);

  const escapeRegExp = useCallback((str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }, []);

  const escapeHtml = useCallback((str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }, []);

  const customTextRenderer = useMemo(() => {
    const q = debouncedSearchQuery.trim();
    if (!q || q.length < 2) return undefined;
    const escaped = escapeRegExp(q);
    const regex = new RegExp(`(${escaped})`, 'gi');

    return ({ str }: { str: string }) => {
      if (!str) return '';
      const parts = str.split(regex);
      if (parts.length === 1) return escapeHtml(str);
      return parts
        .map((part, idx) =>
          idx % 2 === 1
            ? `<mark class="bg-yellow-300/60 dark:bg-yellow-400/60 text-transparent rounded-[1px]" style="background-color: rgba(250, 204, 21, 0.45); color: transparent; border-radius: 2px;">${escapeHtml(part)}</mark>`
            : escapeHtml(part),
        )
        .join('');
    };
  }, [debouncedSearchQuery, escapeRegExp, escapeHtml]);

  return {
    searchQuery,
    setSearchQuery,
    currentMatchIdx,
    searchMatches,
    searchInputRef,
    handleNextMatch,
    handlePrevMatch,
    customTextRenderer,
  };
}

export interface ViewerSearchBarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  matchCount: number;
  currentMatchIdx: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClose?: () => void;
}

export function ViewerSearchBar({
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  matchCount,
  currentMatchIdx,
  onNextMatch,
  onPrevMatch,
  onClose,
}: ViewerSearchBarProps) {
  return (
    <div className="absolute top-3 right-4 z-40 flex items-center gap-1.5 rounded-md border border-border bg-background p-1.5 text-12 font-sans select-none animate-in fade-in slide-in-from-top-2 duration-150 shadow-raised-200">
      <Search className="size-3.5 text-muted-foreground ml-1 shrink-0" strokeWidth={1.5} />
      <input
        ref={searchInputRef}
        type="text"
        aria-label="Find in document"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) onPrevMatch();
            else onNextMatch();
          } else if (e.key === 'Escape') {
            onClose?.();
          }
        }}
        placeholder="Find in document..."
        className="h-6 w-44 bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none font-sans"
      />
      {matchCount > 0 ? (
        <span className="text-11 font-mono tabular-nums text-muted-foreground px-1 shrink-0">
          {currentMatchIdx + 1} / {matchCount}
        </span>
      ) : searchQuery ? (
        <span className="text-11 font-sans text-muted-foreground px-1 shrink-0">0 matches</span>
      ) : null}

      <button
        type="button"
        onClick={onPrevMatch}
        disabled={matchCount === 0}
        className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground disabled:opacity-30 cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={onNextMatch}
        disabled={matchCount === 0}
        className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground disabled:opacity-30 cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="Next match (Enter)"
        aria-label="Next match"
      >
        <ChevronRight className="size-3.5 shrink-0" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => onClose?.()}
        className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer ml-0.5 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="Close (Escape)"
        aria-label="Close search"
      >
        <X className="size-3.5 shrink-0" strokeWidth={1.5} />
      </button>
    </div>
  );
}
