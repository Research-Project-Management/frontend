'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { Search, ChevronLeft, ChevronRight, X, CaseSensitive, WholeWord } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DocumentFulltext } from '@/features/library/domain/types/reader.schema';
import { useViewerSearchAnchors } from '@/features/library/core/coordinator/reader/use-pdf-interaction';
import {
  foldDiacritics,
  searchPdfPages,
  cyclePdfSearchMatch,
  type PdfTextMatch,
} from '@/features/library/domain/reader-search-outline.domain';

export interface PdfSearchDocumentProxy {
  numPages: number;
  getPage?: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{
      items: Array<unknown>;
    }>;
  }>;
}

interface UseViewerSearchOptions {
  isSearchOpen: boolean;
  initialSearchQuery?: string;
  attachmentId?: string;
  scopeId?: string;
  fulltext?: DocumentFulltext | null;
  numPages: number;
  pageRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  pdfDocument?: PdfSearchDocumentProxy | null;
  scrollToPage: (page: number) => void;
}

export function useViewerSearch({
  isSearchOpen,
  initialSearchQuery,
  attachmentId,
  scopeId,
  fulltext,
  numPages,
  pageRefs,
  pdfDocument,
  scrollToPage,
}: UseViewerSearchOptions) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery || '');
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [extractedPageList, setExtractedPageList] = useState<
    ReadonlyArray<{ pageNumber: number; text: string }> | null
  >(null);
  const serverAnchorMatches = useViewerSearchAnchors(
    attachmentId,
    debouncedSearchQuery,
    scopeId,
  );
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
    return fulltext.sections
      .filter((sec) => typeof sec.page === 'number' && Number.isFinite(sec.page) && sec.page >= 1)
      .map((sec) => {
        const lowerCorpus = [
          sec.title ? sec.title.toLowerCase() : '',
          ...(sec.paragraphs ? sec.paragraphs.map((p) => p.toLowerCase()) : []),
        ].join('\n');
        return {
          page: sec.page,
          title: sec.title,
          lowerCorpus,
          foldedCorpus: foldDiacritics(lowerCorpus),
        };
      });
  }, [fulltext?.sections]);

  const backendFulltextPages = useMemo(() => {
    const rawPages = (fulltext as { pages?: Array<{ pageNumber: number; text: string }> } | null | undefined)?.pages;
    if (!Array.isArray(rawPages) || rawPages.length === 0) return null;
    return rawPages.filter(
      (p) =>
        p &&
        typeof p.pageNumber === 'number' &&
        p.pageNumber >= 1 &&
        typeof p.text === 'string',
    );
  }, [fulltext]);

  const hasActiveSearchQuery = debouncedSearchQuery.trim().length >= 2;

  useEffect(() => {
    if (backendFulltextPages && backendFulltextPages.length > 0) {
      setExtractedPageList(backendFulltextPages);
      return;
    }
    if (!pdfDocument) {
      extractedForDocRef.current = null;
      setExtractedPageList(null);
      return;
    }
    if (!hasActiveSearchQuery) return;
    if (extractedForDocRef.current === pdfDocument) return;
    if (typeof pdfDocument.getPage !== 'function' || numPages <= 0) return;

    const currentDoc = pdfDocument;
    let cancelled = false;

    async function extractAllPagesText() {
      const pages: Array<{ pageNumber: number; text: string }> = [];
      const BATCH_SIZE = 4;
      for (let start = 1; start <= numPages; start += BATCH_SIZE) {
        if (cancelled) return;
        const end = Math.min(numPages, start + BATCH_SIZE - 1);
        const batchNums: number[] = [];
        for (let p = start; p <= end; p++) {
          batchNums.push(p);
        }
        const batchResults = await Promise.all(
          batchNums.map(async (p) => {
            if (cancelled) return null;
            let page: Awaited<ReturnType<NonNullable<PdfSearchDocumentProxy['getPage']>>> | undefined;
            try {
              page = await currentDoc.getPage!(p);
              if (cancelled) return null;
              const textContent = await page.getTextContent();
              if (cancelled) return null;
              const pageStr = textContent.items
                .map((item) => {
                  if (item && typeof item === 'object' && 'str' in item) {
                    const s = (item as { str?: unknown }).str;
                    return typeof s === 'string' ? s : '';
                  }
                  return '';
                })
                .join(' ');
              return { pageNumber: p, text: pageStr };
            } catch {
              return null;
            } finally {
              try {
                (page as { cleanup?: () => void } | undefined)?.cleanup?.();
              } catch {
                // Ignore cleanup failure
              }
            }
          }),
        );
        for (const res of batchResults) {
          if (res) pages.push(res);
        }
      }
      if (!cancelled) {
        extractedForDocRef.current = currentDoc;
        setExtractedPageList(pages);
      }
    }

    void extractAllPagesText();
    return () => {
      cancelled = true;
    };
  }, [backendFulltextPages, pdfDocument, numPages, hasActiveSearchQuery]);

  const searchMatches = useMemo(() => {
    const rawQuery = deferredSearchQuery.trim();
    if (!rawQuery || rawQuery.length < 2) return [];
    const qLower = rawQuery.toLowerCase();
    const qFolded = foldDiacritics(qLower);

    const list: Array<
      PdfTextMatch & {
        page: number;
        occurrenceInPage: number;
        title?: string;
      }
    > = [];
    const pageOccurrenceCounter = new Map<number, number>();
    const matchedPages = new Set<number>();

    if (numPages > 0) {
      const extractedByPage = new Map<number, { pageNumber: number; text: string }>();
      if (extractedPageList) {
        for (const pageObj of extractedPageList) {
          extractedByPage.set(pageObj.pageNumber, pageObj);
        }
      }

      const candidatePages: Array<{ pageNumber: number; text: string }> = [];
      for (let p = 1; p <= numPages; p++) {
        const extractedObj = extractedByPage.get(p);
        if (extractedObj) {
          candidatePages.push(extractedObj);
          continue;
        }
        const pEl = pageRefs.current.get(p);
        const domText = pEl?.querySelector('.react-pdf__Page__textContent')?.textContent || '';
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
        const pdfMatches = searchPdfPages(candidatePages, deferredSearchQuery, {
          matchCase,
          wholeWords,
        });
        for (const match of pdfMatches) {
          const occ = pageOccurrenceCounter.get(match.pageNumber) ?? 0;
          pageOccurrenceCounter.set(match.pageNumber, occ + 1);
          matchedPages.add(match.pageNumber);
          list.push({
            ...match,
            page: match.pageNumber,
            occurrenceInPage: occ,
          });
        }
      }
    }

    if (serverAnchorMatches.length > 0) {
      for (const anchor of serverAnchorMatches) {
        const pageNum =
          typeof anchor.pageIndex === 'number' && anchor.pageIndex >= 0
            ? anchor.pageIndex + 1
            : 1;
        if (matchedPages.has(pageNum)) continue;
        const occ = pageOccurrenceCounter.get(pageNum) ?? 0;
        pageOccurrenceCounter.set(pageNum, occ + 1);
        list.push({
          matchIndex: list.length,
          pageNumber: pageNum,
          page: pageNum,
          occurrenceInPage: occ,
          matchedText: rawQuery,
          snippet: anchor.snippet || '',
          charOffset: anchor.charOffsetStart || 0,
        });
      }
      for (const anchor of serverAnchorMatches) {
        const pageNum =
          typeof anchor.pageIndex === 'number' && anchor.pageIndex >= 0
            ? anchor.pageIndex + 1
            : 1;
        matchedPages.add(pageNum);
      }
    }

    if (indexedSections) {
      for (const sec of indexedSections) {
        if (matchedPages.has(sec.page)) continue;
        if (
          sec.lowerCorpus.includes(qLower) ||
          (qFolded && sec.foldedCorpus.includes(qFolded))
        ) {
          list.push({
            matchIndex: list.length,
            pageNumber: sec.page,
            page: sec.page,
            occurrenceInPage: 0,
            matchedText: rawQuery,
            snippet: sec.title || '',
            charOffset: 0,
            title: sec.title,
          });
          matchedPages.add(sec.page);
        }
      }
    }

    return list.sort((a, b) => a.page - b.page || a.occurrenceInPage - b.occurrenceInPage);
  }, [deferredSearchQuery, matchCase, wholeWords, serverAnchorMatches, indexedSections, numPages, pageRefs, extractedPageList]);

  const highlightActiveOccurrenceOnPage = useCallback(
    (pageNumber: number, occurrenceInPage: number) => {
      const applyMarkFocus = () => {
        const pageEl = pageRefs.current.get(pageNumber);
        if (!pageEl) return false;
        const marks = pageEl.querySelectorAll('mark[data-pdf-search-match="true"]');
        if (marks.length === 0) return false;

        pageRefs.current.forEach((el) => {
          el.querySelectorAll('mark[data-pdf-search-active="true"]').forEach((m) => {
            m.removeAttribute('data-pdf-search-active');
            (m as HTMLElement).style.backgroundColor = 'rgba(250, 204, 21, 0.45)';
            (m as HTMLElement).style.boxShadow = 'none';
          });
        });

        const targetMark = (marks[occurrenceInPage] ?? marks[0]) as HTMLElement | undefined;
        if (targetMark) {
          targetMark.setAttribute('data-pdf-search-active', 'true');
          targetMark.style.backgroundColor = 'rgba(249, 115, 22, 0.65)';
          targetMark.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.85)';
          if (typeof targetMark.scrollIntoView === 'function') {
            targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return true;
        }
        return false;
      };

      if (!applyMarkFocus()) {
        setTimeout(() => {
          applyMarkFocus();
        }, 120);
      }
    },
    [pageRefs],
  );

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const cycled = cyclePdfSearchMatch(searchMatches, currentMatchIdx, 'next');
    const nextIdx = cycled.activeMatchIndex >= 0 ? cycled.activeMatchIndex : 0;
    setCurrentMatchIdx(nextIdx);
    const m = searchMatches[nextIdx];
    if (m) {
      scrollToPage(m.page);
      highlightActiveOccurrenceOnPage(m.page, m.occurrenceInPage);
    }
  }, [searchMatches, currentMatchIdx, scrollToPage, highlightActiveOccurrenceOnPage]);

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const cycled = cyclePdfSearchMatch(searchMatches, currentMatchIdx, 'prev');
    const prevIdx = cycled.activeMatchIndex >= 0 ? cycled.activeMatchIndex : 0;
    setCurrentMatchIdx(prevIdx);
    const m = searchMatches[prevIdx];
    if (m) {
      scrollToPage(m.page);
      highlightActiveOccurrenceOnPage(m.page, m.occurrenceInPage);
    }
  }, [searchMatches, currentMatchIdx, scrollToPage, highlightActiveOccurrenceOnPage]);

  // Auto-scroll to first match when search query or options change
  const lastScrolledQueryKeyRef = useRef<string>('');
  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    const queryKey = `${q}|${matchCase}|${wholeWords}`;
    if (q && q.length >= 2 && searchMatches.length > 0 && lastScrolledQueryKeyRef.current !== queryKey) {
      lastScrolledQueryKeyRef.current = queryKey;
      setCurrentMatchIdx(0);
      const first = searchMatches[0];
      if (first?.page) {
        scrollToPage(first.page);
        highlightActiveOccurrenceOnPage(first.page, first.occurrenceInPage);
      }
    }
  }, [debouncedSearchQuery, matchCase, wholeWords, searchMatches, scrollToPage, highlightActiveOccurrenceOnPage]);

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
    const cleanQuery = q.normalize('NFC');
    const targetQuery = matchCase ? cleanQuery : foldDiacritics(cleanQuery);
    if (!targetQuery) return undefined;

    const isWordChar = (ch?: string) => Boolean(ch && /[\p{L}\p{N}_]/u.test(ch));

    return ({ str }: { str: string }) => {
      if (!str) return '';
      const normStr = str.normalize('NFC');
      const quickHaystack = matchCase ? normStr : foldDiacritics(normStr);
      if (!quickHaystack.includes(targetQuery)) {
        return escapeHtml(normStr);
      }

      let targetStr = '';
      const targetToRawStart: number[] = [];
      const targetToRawEnd: number[] = [];

      if (matchCase) {
        targetStr = normStr;
        for (let i = 0; i < normStr.length; i++) {
          targetToRawStart.push(i);
          targetToRawEnd.push(i + 1);
        }
      } else {
        for (let i = 0; i < normStr.length; ) {
          const cp = normStr.codePointAt(i)!;
          const charLen = cp > 0xffff ? 2 : 1;
          const rawChar = normStr.slice(i, i + charLen);
          const foldedChar = foldDiacritics(rawChar);
          for (let k = 0; k < foldedChar.length; k++) {
            targetToRawStart.push(i);
            targetToRawEnd.push(i + charLen);
          }
          targetStr += foldedChar;
          i += charLen;
        }
      }

      if (!targetStr.includes(targetQuery)) {
        return escapeHtml(normStr);
      }

      let out = '';
      let rawCursor = 0;
      let searchPos = 0;
      while (searchPos <= targetStr.length - targetQuery.length) {
        const idx = targetStr.indexOf(targetQuery, searchPos);
        if (idx === -1) break;
        const matchEndIdx = idx + targetQuery.length - 1;
        const rawStart = targetToRawStart[idx] ?? 0;
        const rawEnd = targetToRawEnd[matchEndIdx] ?? normStr.length;

        if (wholeWords) {
          const before = rawStart > 0 ? normStr[rawStart - 1] : undefined;
          const after = rawEnd < normStr.length ? normStr[rawEnd] : undefined;
          if (isWordChar(before) || isWordChar(after)) {
            searchPos = idx + 1;
            continue;
          }
        }

        if (rawStart >= rawCursor && rawEnd > rawStart) {
          out += escapeHtml(normStr.slice(rawCursor, rawStart));
          out += `<mark data-pdf-search-match="true" class="bg-yellow-300/60 dark:bg-yellow-400/60 text-transparent rounded-[1px]" style="background-color: rgba(250, 204, 21, 0.45); color: transparent; border-radius: 2px;">${escapeHtml(normStr.slice(rawStart, rawEnd))}</mark>`;
          rawCursor = rawEnd;
        }
        searchPos = idx + Math.max(1, targetQuery.length);
      }

      out += escapeHtml(normStr.slice(rawCursor));
      return out;
    };
  }, [debouncedSearchQuery, matchCase, wholeWords, escapeHtml]);

  return {
    searchQuery,
    setSearchQuery,
    matchCase,
    setMatchCase,
    wholeWords,
    setWholeWords,
    currentMatchIdx,
    searchMatches,
    searchInputRef,
    handleNextMatch,
    handlePrevMatch,
    customTextRenderer,
  };
}

interface ViewerSearchBarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  matchCase?: boolean;
  onToggleMatchCase?: () => void;
  wholeWords?: boolean;
  onToggleWholeWords?: () => void;
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
  matchCase = false,
  onToggleMatchCase,
  wholeWords = false,
  onToggleWholeWords,
  matchCount,
  currentMatchIdx,
  onNextMatch,
  onPrevMatch,
  onClose,
}: ViewerSearchBarProps) {
  return (
    <div className="absolute top-3 right-4 z-40 flex items-center gap-1 rounded-md border border-border bg-background p-1.5 text-12 font-sans select-none animate-in fade-in slide-in-from-top-2 duration-150 shadow-raised-200">
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

      {onToggleMatchCase && (
        <button
          type="button"
          onClick={onToggleMatchCase}
          aria-pressed={matchCase}
          aria-label="Match case"
          title="Match Case (Aa)"
          className={cn(
            'size-6 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
            matchCase
              ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40 font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <CaseSensitive className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      )}

      {onToggleWholeWords && (
        <button
          type="button"
          onClick={onToggleWholeWords}
          aria-pressed={wholeWords}
          aria-label="Match whole words"
          title="Whole Words ([ab])"
          className={cn(
            'size-6 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
            wholeWords
              ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40 font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <WholeWord className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      )}

      <div className="w-px h-3.5 bg-border mx-0.5" />

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
