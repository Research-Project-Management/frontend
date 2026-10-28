'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DocumentFulltext } from '@/features/library/domain/types/reader.types';
import {
  foldDiacritics,
  searchPdfPages,
} from '@/features/library/domain/reader-persistence.helpers';

export interface PdfSearchDocumentProxy {
  numPages: number;
  getPage?: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{
      items: Array<unknown>;
    }>;
  }>;
}

export interface UseViewerSearchOptions {
  isSearchOpen: boolean;
  initialSearchQuery?: string;
  fulltext?: DocumentFulltext | null;
  numPages: number;
  pageRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  pdfDocument?: PdfSearchDocumentProxy | null;
  scrollToPage: (page: number) => void;
}

export function useViewerSearch({
  isSearchOpen,
  initialSearchQuery,
  fulltext,
  numPages,
  pageRefs,
  pdfDocument,
  scrollToPage,
}: UseViewerSearchOptions) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery || '');
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [extractedPageList, setExtractedPageList] = useState<
    ReadonlyArray<{ pageNumber: number; text: string }> | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const extractedForDocRef = useRef<PdfSearchDocumentProxy | null>(null);
  const domPageObjectCacheRef = useRef<Map<number, { pageNumber: number; text: string }>>(
    new Map(),
  );

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
    return fulltext.sections.map((sec) => {
      const lowerCorpus = [
        sec.title ? sec.title.toLowerCase() : '',
        ...(sec.paragraphs ? sec.paragraphs.map((p) => p.toLowerCase()) : []),
      ].join('\n');
      return {
        page: sec.page || 1,
        title: sec.title,
        lowerCorpus,
        foldedCorpus: foldDiacritics(lowerCorpus),
      };
    });
  }, [fulltext?.sections]);

  useEffect(() => {
    if (!pdfDocument) {
      extractedForDocRef.current = null;
      setExtractedPageList(null);
      return;
    }
    const q = debouncedSearchQuery.trim();
    if (!isSearchOpen && (!q || q.length < 2)) return;
    if (extractedForDocRef.current === pdfDocument) return;
    if (typeof pdfDocument.getPage !== 'function' || numPages <= 0) return;

    let cancelled = false;
    extractedForDocRef.current = pdfDocument;

    async function extractAllPagesText() {
      const pages: Array<{ pageNumber: number; text: string }> = [];
      for (let p = 1; p <= numPages; p++) {
        if (cancelled) return;
        try {
          const page = await pdfDocument!.getPage!(p);
          if (cancelled) return;
          const textContent = await page.getTextContent();
          if (cancelled) return;
          const pageStr = textContent.items
            .map((item) => {
              if (item && typeof item === 'object' && 'str' in item) {
                const s = (item as { str?: unknown }).str;
                return typeof s === 'string' ? s : '';
              }
              return '';
            })
            .join(' ');
          pages.push({ pageNumber: p, text: pageStr });
        } catch {
          // Ignore individual page extraction failure
        }
      }
      if (!cancelled) {
        setExtractedPageList(pages);
      }
    }

    void extractAllPagesText();
    return () => {
      cancelled = true;
    };
  }, [pdfDocument, numPages, isSearchOpen, debouncedSearchQuery]);

  const searchMatches = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const qFolded = foldDiacritics(q);

    const list: { page: number; title?: string }[] = [];
    const matchedPages = new Set<number>();
    if (indexedSections) {
      for (const sec of indexedSections) {
        if (
          sec.lowerCorpus.includes(q) ||
          (qFolded && sec.foldedCorpus.includes(qFolded))
        ) {
          list.push({ page: sec.page, title: sec.title });
          matchedPages.add(sec.page);
        }
      }
    }
    if (numPages > 0) {
      const extractedByPage = new Map<number, { pageNumber: number; text: string }>();
      if (extractedPageList) {
        for (const pageObj of extractedPageList) {
          extractedByPage.set(pageObj.pageNumber, pageObj);
        }
      }

      const candidatePages: Array<{ pageNumber: number; text: string }> = [];
      for (let p = 1; p <= numPages; p++) {
        if (matchedPages.has(p)) continue;
        const extractedObj = extractedByPage.get(p);
        if (extractedObj) {
          candidatePages.push(extractedObj);
          continue;
        }
        const pEl = pageRefs.current.get(p);
        const domText = pEl?.textContent || '';
        if (domText) {
          const existingDomObj = domPageObjectCacheRef.current.get(p);
          if (existingDomObj && existingDomObj.text === domText) {
            candidatePages.push(existingDomObj);
          } else {
            const nextDomObj = { pageNumber: p, text: domText };
            domPageObjectCacheRef.current.set(p, nextDomObj);
            candidatePages.push(nextDomObj);
          }
        }
      }

      if (candidatePages.length > 0) {
        const pdfMatches = searchPdfPages(candidatePages, deferredSearchQuery);
        for (const match of pdfMatches) {
          if (!matchedPages.has(match.pageNumber)) {
            list.push({ page: match.pageNumber });
            matchedPages.add(match.pageNumber);
          }
        }
      }
    }
    return list.sort((a, b) => a.page - b.page);
  }, [deferredSearchQuery, indexedSections, numPages, pageRefs, extractedPageList]);

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
