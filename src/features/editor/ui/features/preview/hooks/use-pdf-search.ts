'use client';

/**
 * use-pdf-search.ts
 *
 * In-document PDF Search Engine with Overleaf Parity (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-pdf-search.ts`
 *
 * Features:
 * - Real-time case sensitivity, whole word boundary, and regex matching.
 * - Multi-page text indexing with page numbers and match coordinates.
 * - Live DOM text layer highlighting with active match spotlight (.flux-pdf-highlight / .flux-pdf-highlight-current).
 * - CodeMirror editor selection synchronization and command bus integration.
 * - Keyboard shortcuts: Enter / Shift+Enter navigation, Alt+C, Alt+W, Alt+R, Esc.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  editorCommandBus,
  getActiveEditorEngine,
} from '@/features/editor/coordinators/command-bus';

export interface PdfSearchMatch {
  pageNum: number; // 1-based page number
  matchIndexInPage: number; // 0-based match index within page
  totalIndex: number; // 0-based match index across document
  text?: string;
}

export interface UsePdfSearchOptions {
  pdfDocRef: React.MutableRefObject<any>;
  pdfContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  onScrollToPage?: (pageNum: number) => void;
  onJumpToSource?: (file: string | null, line: number) => void;
  synctexMapRef?: React.MutableRefObject<any>;
}

export function escapePdfSearchRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPdfSearchRegex(
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  regex: boolean,
  global: boolean = true,
): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    let pattern = regex ? trimmed : escapePdfSearchRegExp(trimmed);
    if (wholeWord) {
      pattern = `\\b(?:${pattern})\\b`;
    }
    const flags = (caseSensitive ? '' : 'i') + (global ? 'g' : '');
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function usePdfSearch({
  pdfDocRef,
  pdfContainerRef,
  onScrollToPage,
}: UsePdfSearchOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [isRegexError, setIsRegexError] = useState(false);

  const [matches, setMatches] = useState<PdfSearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  // Clear any existing DOM highlight spans in .textLayer / .react-pdf__Page__textContent
  const clearDomHighlights = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = pdfContainerRef.current;
    if (!container) return;

    const highlights = container.querySelectorAll(
      '.flux-pdf-highlight, .flux-pdf-highlight-current',
    );
    highlights.forEach((node) => {
      const parent = node.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(node.textContent || ''), node);
        parent.normalize();
      }
    });
  }, [pdfContainerRef]);

  // Apply visual highlight marks into DOM .textLayer
  const applyDomHighlights = useCallback(
    (
      activeMatchIdx: number = currentMatchIndex,
      searchQuery: string = query,
      cs: boolean = caseSensitive,
      ww: boolean = wholeWord,
      re: boolean = regex,
    ) => {
      if (typeof document === 'undefined') return;
      const container = pdfContainerRef.current;
      if (!container) return;

      clearDomHighlights();

      const rx = buildPdfSearchRegex(searchQuery, cs, ww, re, true);
      if (!rx) return;

      const textLayers = container.querySelectorAll(
        '.textLayer, .react-pdf__Page__textContent',
      );
      if (!textLayers || textLayers.length === 0) return;

      let globalMatchCounter = 0;

      textLayers.forEach((layer) => {
        const spans = layer.querySelectorAll('span');
        spans.forEach((span) => {
          const originalText = span.textContent || '';
          if (!originalText) return;

          rx.lastIndex = 0;
          if (!rx.test(originalText)) return;

          rx.lastIndex = 0;
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = rx.exec(originalText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (end === start) {
              rx.lastIndex++;
              continue;
            }

            if (start > lastIndex) {
              fragment.appendChild(
                document.createTextNode(originalText.slice(lastIndex, start)),
              );
            }

            const isCurrent = globalMatchCounter === activeMatchIdx;
            const mark = document.createElement('mark');
            mark.className = isCurrent
              ? 'flux-pdf-highlight flux-pdf-highlight-current'
              : 'flux-pdf-highlight';
            mark.setAttribute('data-match-index', String(globalMatchCounter));
            mark.textContent = match[0];
            fragment.appendChild(mark);

            globalMatchCounter++;
            lastIndex = end;
          }

          if (lastIndex < originalText.length) {
            fragment.appendChild(
              document.createTextNode(originalText.slice(lastIndex)),
            );
          }

          span.textContent = '';
          span.appendChild(fragment);
        });
      });

      const activeMark = container.querySelector(
        `mark[data-match-index="${activeMatchIdx}"]`,
      ) as HTMLElement | null;
      if (activeMark && typeof activeMark.scrollIntoView === 'function') {
        activeMark.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    },
    [
      pdfContainerRef,
      clearDomHighlights,
      query,
      caseSensitive,
      wholeWord,
      regex,
      currentMatchIndex,
    ],
  );

  // Update active mark spotlight when index changes
  const updateActiveHighlight = useCallback(
    (targetIndex: number) => {
      if (typeof document === 'undefined') return;
      const container = pdfContainerRef.current;
      if (!container) return;

      const currentMarks = container.querySelectorAll('.flux-pdf-highlight-current');
      currentMarks.forEach((m) => m.classList.remove('flux-pdf-highlight-current'));

      const targetMark = container.querySelector(
        `mark[data-match-index="${targetIndex}"]`,
      ) as HTMLElement | null;

      if (targetMark) {
        targetMark.classList.add('flux-pdf-highlight-current');
        if (typeof targetMark.scrollIntoView === 'function') {
          targetMark.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      } else {
        applyDomHighlights(targetIndex);
      }
    },
    [pdfContainerRef, applyDomHighlights],
  );

  // Scroll viewport to target match page
  const scrollToMatch = useCallback(
    (match: PdfSearchMatch, matchIndex: number) => {
      if (onScrollToPage) {
        onScrollToPage(match.pageNum);
      }
      updateActiveHighlight(matchIndex);
    },
    [onScrollToPage, updateActiveHighlight],
  );

  // Execute text extraction and matching across all document pages
  const executeSearch = useCallback(
    async (
      searchQuery: string,
      opts?: {
        caseSens?: boolean;
        word?: boolean;
        reg?: boolean;
      },
    ) => {
      clearDomHighlights();

      const cs = opts?.caseSens ?? caseSensitive;
      const ww = opts?.word ?? wholeWord;
      const re = opts?.reg ?? regex;

      const trimmed = searchQuery.trim();
      if (!trimmed || !pdfDocRef.current) {
        setMatches([]);
        setCurrentMatchIndex(0);
        setIsSearching(false);
        setIsRegexError(false);
        return;
      }

      const rx = buildPdfSearchRegex(trimmed, cs, ww, re, true);
      if (!rx) {
        if (re) {
          setIsRegexError(true);
        }
        setMatches([]);
        setCurrentMatchIndex(0);
        setIsSearching(false);
        return;
      }

      setIsRegexError(false);
      setIsSearching(true);
      const pdf = pdfDocRef.current;
      const totalPages = pdf.numPages || 0;
      const foundMatches: PdfSearchMatch[] = [];

      try {
        let globalIdx = 0;
        for (let p = 1; p <= totalPages; p++) {
          const page = await pdf.getPage(p);
          if (!page || typeof page.getTextContent !== 'function') continue;
          const textContent = await page.getTextContent();
          if (!textContent || !Array.isArray(textContent.items)) continue;

          const pageStr = textContent.items
            .map((item: any) => item.str || '')
            .join(' ');

          rx.lastIndex = 0;
          let match: RegExpExecArray | null;
          let pageMatchIdx = 0;

          while ((match = rx.exec(pageStr)) !== null) {
            foundMatches.push({
              pageNum: p,
              matchIndexInPage: pageMatchIdx,
              totalIndex: globalIdx,
              text: match[0],
            });
            globalIdx++;
            pageMatchIdx++;

            if (match[0].length === 0) {
              rx.lastIndex++;
            }
          }
        }

        setMatches(foundMatches);
        setCurrentMatchIndex(0);

        if (foundMatches.length > 0) {
          scrollToMatch(foundMatches[0], 0);
          applyDomHighlights(0, trimmed, cs, ww, re);
        }
      } catch (err) {
        console.warn('[usePdfSearch] Error during search:', err);
        setMatches([]);
      } finally {
        setIsSearching(false);
      }
    },
    [
      pdfDocRef,
      clearDomHighlights,
      caseSensitive,
      wholeWord,
      regex,
      scrollToMatch,
      applyDomHighlights,
    ],
  );

  // Helper to get selected text from editor or window selection
  const getSelectedText = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    try {
      const engine = getActiveEditorEngine();
      const editorSel = engine?.getSelectedText?.();
      if (
        editorSel &&
        editorSel.trim() &&
        editorSel.length < 100 &&
        !editorSel.includes('\n')
      ) {
        return editorSel.trim();
      }
    } catch {
      // ignore
    }

    const sel = window.getSelection()?.toString();
    if (sel && sel.trim() && sel.length < 100 && !sel.includes('\n')) {
      return sel.trim();
    }
    return '';
  }, []);

  // Advance to next match
  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(matches[nextIdx], nextIdx);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Go to previous match
  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(matches[prevIdx], prevIdx);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Option toggles
  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive((prev) => !prev);
  }, []);

  const toggleWholeWord = useCallback(() => {
    setWholeWord((prev) => !prev);
  }, []);

  const toggleRegex = useCallback(() => {
    setRegex((prev) => !prev);
  }, []);

  // Open search with optional pre-fill
  const openSearch = useCallback(
    (initialQuery?: string) => {
      setIsOpen(true);
      if (initialQuery !== undefined) {
        setQuery(initialQuery);
      } else if (!query) {
        const sel = getSelectedText();
        if (sel) setQuery(sel);
      }
    },
    [query, getSelectedText],
  );

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setMatches([]);
    setCurrentMatchIndex(0);
    setIsRegexError(false);
    clearDomHighlights();
  }, [clearDomHighlights]);

  const toggleSearch = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        if (!query) {
          const sel = getSelectedText();
          if (sel) setQuery(sel);
        }
      } else {
        setQuery('');
        setMatches([]);
        setCurrentMatchIndex(0);
        setIsRegexError(false);
        clearDomHighlights();
      }
      return next;
    });
  }, [query, clearDomHighlights, getSelectedText]);

  // Debounced search when query or options change
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, isOpen, caseSensitive, wholeWord, regex, executeSearch]);

  // Command bus subscriptions
  useEffect(() => {
    const unsubFind = editorCommandBus.subscribe('viewer:find', (cmd) => {
      if (cmd.open === false) {
        closeSearch();
        return;
      }
      setIsOpen(true);
      if (cmd.caseSensitive !== undefined) setCaseSensitive(cmd.caseSensitive);
      if (cmd.wholeWord !== undefined) setWholeWord(cmd.wholeWord);
      if (cmd.regex !== undefined) setRegex(cmd.regex);
      if (cmd.query !== undefined) {
        setQuery(cmd.query);
      } else if (!query) {
        const sel = getSelectedText();
        if (sel) setQuery(sel);
      }
    });

    const unsubNext = editorCommandBus.subscribe('viewer:find-next', () => {
      nextMatch();
    });

    const unsubPrev = editorCommandBus.subscribe('viewer:find-prev', () => {
      prevMatch();
    });

    return () => {
      unsubFind();
      unsubNext();
      unsubPrev();
    };
  }, [closeSearch, query, getSelectedText, nextMatch, prevMatch]);

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
          openSearch();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openSearch, closeSearch, pdfContainerRef]);

  return {
    isOpen,
    query,
    setQuery,
    matches,
    currentMatchIndex,
    isSearching,
    caseSensitive,
    setCaseSensitive,
    toggleCaseSensitive,
    wholeWord,
    setWholeWord,
    toggleWholeWord,
    regex,
    setRegex,
    toggleRegex,
    isRegexError,
    nextMatch,
    prevMatch,
    openSearch,
    closeSearch,
    toggleSearch,
    applyDomHighlights,
    clearDomHighlights,
    executeSearch,
  };
}
