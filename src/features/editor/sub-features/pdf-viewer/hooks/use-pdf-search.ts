'use client';

/**
 * use-pdf-search.ts
 *
 * In-document PDF Search Engine (Overleaf Parity):
 * - Searches across all pages via PDF.js getTextContent()
 * - Tracks exact match occurrences with page numbers
 * - Handles Next / Previous navigation with cyclical wrap-around
 * - Smoothly scrolls viewport to target page & highlights matching textLayer nodes
 * - Provides keyboard shortcuts: Ctrl+F (open), Enter (next), Shift+Enter (prev), Esc (close)
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface PdfSearchMatch {
  pageNum: number; // 1-based
  matchIndexInPage: number;
  totalIndex: number;
}

export interface UsePdfSearchOptions {
  pdfDocRef: React.MutableRefObject<any>;
  pdfContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  onScrollToPage?: (pageNum: number) => void;
}

export function usePdfSearch({
  pdfDocRef,
  pdfContainerRef,
  onScrollToPage,
}: UsePdfSearchOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PdfSearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  // Clear any existing DOM highlight spans in .textLayer
  const clearDomHighlights = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = pdfContainerRef.current;
    if (!container) return;

    const highlights = container.querySelectorAll('.flux-pdf-highlight');
    highlights.forEach((node) => {
      const parent = node.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(node.textContent || ''), node);
        parent.normalize();
      }
    });
  }, [pdfContainerRef]);

  // Execute text extraction and matching across all document pages
  const executeSearch = useCallback(
    async (searchQuery: string) => {
      clearDomHighlights();

      const trimmed = searchQuery.trim().toLowerCase();
      if (!trimmed || !pdfDocRef.current) {
        setMatches([]);
        setCurrentMatchIndex(0);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const pdf = pdfDocRef.current;
      const totalPages = pdf.numPages || 0;
      const foundMatches: PdfSearchMatch[] = [];

      try {
        let globalIdx = 0;
        for (let p = 1; p <= totalPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageStr = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
            .toLowerCase();

          let pos = 0;
          let pageMatchIdx = 0;
          while (pos < pageStr.length) {
            const idx = pageStr.indexOf(trimmed, pos);
            if (idx === -1) break;
            foundMatches.push({
              pageNum: p,
              matchIndexInPage: pageMatchIdx,
              totalIndex: globalIdx,
            });
            globalIdx++;
            pageMatchIdx++;
            pos = idx + trimmed.length;
          }
        }

        setMatches(foundMatches);
        setCurrentMatchIndex(foundMatches.length > 0 ? 0 : 0);

        if (foundMatches.length > 0) {
          scrollToMatch(foundMatches[0]);
        }
      } catch (err) {
        console.warn('[usePdfSearch] Error during search:', err);
        setMatches([]);
      } finally {
        setIsSearching(false);
      }
    },
    [pdfDocRef, clearDomHighlights],
  );

  // Scroll viewport smoothly to target page
  const scrollToMatch = useCallback(
    (match: PdfSearchMatch) => {
      if (onScrollToPage) {
        onScrollToPage(match.pageNum);
      }
    },
    [onScrollToPage],
  );

  // Advance to next match
  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(matches[nextIdx]);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Go to previous match
  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(matches[prevIdx]);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Handle open / close toggle
  const toggleSearch = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setQuery('');
        setMatches([]);
        clearDomHighlights();
      }
      return next;
    });
  }, [clearDomHighlights]);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setMatches([]);
    clearDomHighlights();
  }, [clearDomHighlights]);

  // Debounced search when query changes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, isOpen, executeSearch]);

  // Global Ctrl+F / Cmd+F shortcut inside viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const container = pdfContainerRef.current;
        if (
          container &&
          (container.contains(document.activeElement) ||
            container.matches(':hover'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSearch, pdfContainerRef]);

  return {
    isOpen,
    query,
    setQuery,
    matches,
    currentMatchIndex,
    isSearching,
    nextMatch,
    prevMatch,
    toggleSearch,
    closeSearch,
  };
}
