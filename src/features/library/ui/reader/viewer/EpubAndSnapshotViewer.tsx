'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Highlighter,
  StickyNote,
  Loader2,
  Globe,
  ExternalLink,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { cn } from '@/shared/lib/utils';
import { useReaderDocumentBlobLoader } from '@/features/library/core/coordinator/reader/use-reader';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/domain/reader.domain';
import type {
  ReaderNavigationTarget,
  ReaderAnnotation,
  PdfOutlineItem,
  ActiveHighlightTooltipState,
} from '@/features/library/types/reader.types';
import { AnnotationQuickEditCard } from './PageAnnotationOverlay';
import {
  sanitizeReaderHtml,
  unpackEpubArchiveChapters,
  highlightReaderHtml,
  type EpubChapter,
} from './ViewerPageCanvas';

export type { EpubChapter };

export interface EpubAndSnapshotViewerProps {
  url: string;
  mode: 'epub' | 'snapshot';
  scopeId?: string;
  title?: string;
  sourceUrl?: string;
  themeMode?: 'normal' | 'sepia' | 'dark' | 'invert';
  zoom?: number;
  activeColor?: string;
  onSelectColor?: (hex: string) => void;
  annotations?: ReaderAnnotation[];
  onOutlineLoad?: (outline: PdfOutlineItem[]) => void;
  targetPage?: ReaderNavigationTarget | null;
  onVisiblePageChange?: (page: number) => void;
  onAddToNote?: (text: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi?: (text: string, pageNumber?: number) => void;
  onAnnotate?: (
    text: string,
    pageNum?: number,
    colorHex?: string,
  ) => Promise<unknown> | void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[] },
  ) => Promise<unknown>;
  onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  onPageChange?: (current: number, total: number) => void;
  isSearchOpen?: boolean;
  onCloseSearch?: () => void;
  initialSearchQuery?: string;
}

/**
 * Unified EPUB & Web Snapshot Reader
 * Supports:
 * - Native `.epub` archive unpacking via JSZip (OPF spine + TOC + Chapter HTML)
 * - Clean Web Snapshot HTML rendering
 * - Text selection toolbar to Highlight & Add to Note (1:1 with PDF Reader)
 * - Reading themes (Normal, Sepia, Dark) & Zoom scaling
 */
export function EpubAndSnapshotViewer({
  url,
  mode,
  scopeId,
  title,
  sourceUrl,
  themeMode = 'normal',
  zoom = 1.0,
  activeColor = '#ffd400',
  onSelectColor,
  annotations = [],
  onOutlineLoad,
  targetPage,
  onVisiblePageChange,
  onAddToNote,
  onAskAi,
  onAnnotate,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onPageChange,
  isSearchOpen = false,
  onCloseSearch,
  initialSearchQuery = '',
}: EpubAndSnapshotViewerProps) {
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  const onVisiblePageChangeRef = useRef(onVisiblePageChange);
  useEffect(() => {
    onVisiblePageChangeRef.current = onVisiblePageChange;
  }, [onVisiblePageChange]);

  const onOutlineLoadRef = useRef(onOutlineLoad);
  useEffect(() => {
    onOutlineLoadRef.current = onOutlineLoad;
  }, [onOutlineLoad]);

  const [snapshotHtml, setSnapshotHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [activeHighlightTooltip, setActiveHighlightTooltip] =
    useState<ActiveHighlightTooltipState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const loadDocumentBlob = useReaderDocumentBlobLoader();

  // Load EPUB or Snapshot
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        if (mode === 'snapshot') {
          const blob = await loadDocumentBlob(url, abortController.signal, {
            scopeId,
            allowHtml: true,
          });
          if (cancelled || abortController.signal.aborted) return;

          const magicBytes = await blob.slice(0, 5).text();
          if (magicBytes === '%PDF-' || blob.type === 'application/pdf') {
            throw new Error(
              'This document is a PDF document, not an HTML web snapshot. Please open it with the PDF viewer.',
            );
          }

          const rawHtml = await blob.text();
          if (cancelled || abortController.signal.aborted) return;
          const sanitized = sanitizeReaderHtml(rawHtml);
          setSnapshotHtml(sanitized);
          onPageChangeRef.current?.(1, 1);
          onVisiblePageChangeRef.current?.(1);
          setIsLoading(false);
          return;
        }

        const blob = await loadDocumentBlob(url, abortController.signal, { scopeId });
        if (cancelled || abortController.signal.aborted) return;

        const epubMagic = await blob.slice(0, 5).text();
        if (epubMagic === '%PDF-' || blob.type === 'application/pdf') {
          throw new Error(
            'This document is a PDF document, not an EPUB eBook. Please open it with the PDF viewer.',
          );
        }

        const buffer = await blob.arrayBuffer();
        if (cancelled || abortController.signal.aborted) return;
        const loadedChapters = await unpackEpubArchiveChapters(
          buffer,
          abortController.signal,
        );
        if (cancelled || abortController.signal.aborted) return;

        setChapters(loadedChapters);
        setCurrentChapterIndex(0);
        const total = Math.max(1, loadedChapters.length);
        onPageChangeRef.current?.(1, total);
        onVisiblePageChangeRef.current?.(1);
        onOutlineLoadRef.current?.(
          loadedChapters.map((ch, idx) => ({
            title: ch.title,
            pageNumber: idx + 1,
          })),
        );
      } catch (err) {
        if (!cancelled && !abortController.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not render this document.',
          );
        }
      } finally {
        if (!cancelled && !abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [url, mode, scopeId, loadDocumentBlob]);

  // Sync external targetPage navigation (from ReaderToolbar or ReaderSidebar)
  useEffect(() => {
    if (!targetPage || targetPage.pageNumber < 1) return;
    if (mode === 'epub' && chapters.length > 0) {
      const nextIdx = Math.max(0, Math.min(chapters.length - 1, targetPage.pageNumber - 1));
      setCurrentChapterIndex(nextIdx);
      onPageChangeRef.current?.(nextIdx + 1, chapters.length);
      onVisiblePageChangeRef.current?.(nextIdx + 1);
    } else if (mode === 'snapshot') {
      onPageChangeRef.current?.(1, 1);
      onVisiblePageChangeRef.current?.(1);
    }
  }, [targetPage, mode, chapters.length]);

  const handleMouseUp = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection()?.toString().trim() || '';
    setSelectedText(sel);
  }, []);

  const handleViewportClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const markEl = target.closest('mark[data-annotation-id]') as HTMLElement | null;
      if (!markEl) {
        setActiveHighlightTooltip(null);
        return;
      }
      const annId = markEl.getAttribute('data-annotation-id');
      if (!annId) return;
      const matchedAnn = annotations.find((a) => a.id === annId);
      if (!matchedAnn) return;

      const viewport = viewportRef.current;
      if (!viewport) return;
      const markRect = markEl.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();
      const top = markRect.bottom - vpRect.top + viewport.scrollTop + 6;
      const left = Math.max(
        16,
        Math.min(
          viewport.clientWidth - 300,
          markRect.left - vpRect.left + viewport.scrollLeft,
        ),
      );

      setActiveHighlightTooltip({
        id: matchedAnn.id,
        color: matchedAnn.color || '#ffd400',
        comment: matchedAnn.comment || '',
        quote: matchedAnn.quoteText || matchedAnn.text || markEl.textContent || '',
        top,
        left,
        ann: matchedAnn,
      });
    },
    [annotations],
  );

  const handlePrevChapter = () => {
    const next = Math.max(0, currentChapterIndex - 1);
    setCurrentChapterIndex(next);
    onPageChangeRef.current?.(next + 1, chapters.length);
    onVisiblePageChangeRef.current?.(next + 1);
  };

  const handleNextChapter = () => {
    const next = Math.min(chapters.length - 1, currentChapterIndex + 1);
    setCurrentChapterIndex(next);
    onPageChangeRef.current?.(next + 1, chapters.length);
    onVisiblePageChangeRef.current?.(next + 1);
  };

  const currentChapter = chapters[currentChapterIndex];
  const currentPageNum = mode === 'epub' ? currentChapterIndex + 1 : 1;

  const renderedChapterHtml = useMemo(() => {
    if (!currentChapter) return '';
    return highlightReaderHtml(
      currentChapter.htmlContent,
      annotations,
      currentPageNum,
      isSearchOpen,
      deferredSearchQuery,
    );
  }, [currentChapter, annotations, currentPageNum, isSearchOpen, deferredSearchQuery]);

  const renderedSnapshotHtml = useMemo(() => {
    if (!snapshotHtml) return '';
    return highlightReaderHtml(
      snapshotHtml,
      annotations,
      1,
      isSearchOpen,
      deferredSearchQuery,
    );
  }, [snapshotHtml, annotations, isSearchOpen, deferredSearchQuery]);

  const themeClasses =
    themeMode === 'dark'
      ? 'bg-card text-card-foreground'
      : themeMode === 'invert'
        ? 'bg-background text-foreground invert hue-rotate-180'
        : themeMode === 'sepia'
          ? 'bg-[#f4ecd8] text-[#3c3222]'
          : 'bg-background text-foreground';

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 bg-muted/20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-12 text-muted-foreground">
          {mode === 'epub'
            ? 'Opening EPUB eBook chapters...'
            : 'Loading archived Web Snapshot...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-13 font-medium text-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(sourceUrl || url, '_blank', 'noopener,noreferrer')}
        >
          {mode === 'snapshot' && sourceUrl ? 'Open Original Page' : 'Download File Instead'}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-0 overflow-hidden relative',
        themeClasses,
      )}
    >
      {/* Top Sub-bar for EPUB Chapters or Snapshot Controls */}
      <div className="h-9 px-4 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 select-none bg-background/80 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'epub' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsTocOpen((v) => !v)}
                className="h-7 px-2 text-11 gap-1.5 cursor-pointer"
              >
                <List className="size-3.5" />
                <span>Chapters ({chapters.length})</span>
              </Button>
              {currentChapter && (
                <span className="text-12 font-medium text-muted-foreground truncate">
                  {currentChapter.title}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-12 text-muted-foreground truncate">
              <Globe className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">
                {title || 'Archived Web Snapshot'}
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 text-primary hover:underline ml-2 shrink-0"
                >
                  Original Page <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Selection Quick Action Bar (Highlight & Add to Note) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedText && (
            <div className="flex items-center gap-1 bg-muted border border-border rounded-md px-2 py-0.5">
              <div className="flex items-center gap-1 pr-1 border-r border-border/60">
                {ANNOTATION_PALETTE_COLORS.map((c) => {
                  const isCurrent = activeColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={`Highlight (${c.label})`}
                      aria-label={`Highlight (${c.label})`}
                      onClick={() => {
                        onSelectColor?.(c.hex);
                        onAnnotate?.(
                          selectedText,
                          mode === 'epub' ? currentChapterIndex + 1 : 1,
                          c.hex,
                        );
                        setSelectedText('');
                      }}
                      className={cn(
                        'size-3.5 rounded-full border border-border transition-transform hover:scale-110 cursor-pointer',
                        isCurrent && 'ring-1 ring-primary ring-offset-1',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
              {onAnnotate && (
                <button
                  type="button"
                  onClick={() => {
                    onAnnotate(
                      selectedText,
                      mode === 'epub' ? currentChapterIndex + 1 : 1,
                      activeColor,
                    );
                    setSelectedText('');
                  }}
                  className="h-6 px-2 rounded text-11 font-medium text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer"
                >
                  <Highlighter className="size-3 text-foreground" />
                  <span>Save Highlight</span>
                </button>
              )}
              {onAddToNote && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToNote(
                      selectedText,
                      mode === 'epub' ? currentChapterIndex + 1 : 1,
                    );
                    setSelectedText('');
                  }}
                  className="h-6 px-2 rounded text-11 font-medium text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer"
                >
                  <StickyNote className="size-3 text-foreground" />
                  <span>Add to Note</span>
                </button>
              )}
              {onAskAi && (
                <button
                  type="button"
                  onClick={() => {
                    onAskAi(
                      selectedText,
                      mode === 'epub' ? currentChapterIndex + 1 : 1,
                    );
                    setSelectedText('');
                  }}
                  className="h-6 px-2 rounded text-11 font-medium whitespace-nowrap shrink-0 text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer"
                >
                  <img
                    src="/Chat.svg"
                    alt="AI Assistant"
                    className="size-3 rounded-full object-cover shrink-0"
                  />
                  <span>Ask AI</span>
                </button>
              )}
            </div>
          )}

          {mode === 'epub' && chapters.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentChapterIndex <= 0}
                onClick={handlePrevChapter}
                className="h-7 px-2 text-11 cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>Prev</span>
              </Button>
              <span className="text-11 font-mono px-1.5 text-muted-foreground">
                {currentChapterIndex + 1} / {chapters.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentChapterIndex >= chapters.length - 1}
                onClick={handleNextChapter}
                className="h-7 px-2 text-11 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area with Collapsible EPUB Table of Contents */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {isSearchOpen && (
          <div className="absolute top-3 right-5 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-raised-200">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in document..."
              className="w-44 bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none"
            />
            {onCloseSearch && (
              <button
                type="button"
                onClick={onCloseSearch}
                aria-label="Close search"
                className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {mode === 'epub' && isTocOpen && (
          <aside className="w-64 border-r border-border bg-background/95 overflow-y-auto p-2 flex flex-col gap-0.5 shrink-0 z-10">
            <div className="px-2 py-1 text-11 font-semibold text-muted-foreground uppercase tracking-wider">
              Table of Contents
            </div>
            {chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setCurrentChapterIndex(idx);
                  onPageChange?.(idx + 1, chapters.length);
                  onVisiblePageChange?.(idx + 1);
                  setIsTocOpen(false);
                }}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-left text-xs truncate cursor-pointer transition-colors',
                  idx === currentChapterIndex
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {idx + 1}. {ch.title}
              </button>
            ))}
          </aside>
        )}

        {/* Reader Scroll Viewport */}
        <div
          ref={viewportRef}
          onMouseUp={handleMouseUp}
          onClick={handleViewportClick}
          className="flex-1 overflow-y-auto px-6 py-8 md:px-14 relative"
        >
          {activeHighlightTooltip && (
            <AnnotationQuickEditCard
              tooltip={activeHighlightTooltip}
              visiblePage={currentPageNum}
              onUpdateAnnotation={onUpdateAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onAddToNote={onAddToNote}
              onAskAi={onAskAi}
              onUpdateTooltip={setActiveHighlightTooltip}
              onClose={() => setActiveHighlightTooltip(null)}
            />
          )}
          {mode === 'epub' ? (
            currentChapter ? (
              <article
                style={{ fontSize: `${Math.round(zoom * 100)}%` }}
                className="max-w-3xl mx-auto prose prose-sm md:prose-base dark:prose-invert leading-relaxed select-text"
                dangerouslySetInnerHTML={{ __html: renderedChapterHtml }}
              />
            ) : (
              <div className="text-center text-muted-foreground py-12 text-13">
                <BookOpen className="size-8 mx-auto mb-2 stroke-1" />
                No readable chapters found in this EPUB file.
              </div>
            )
          ) : snapshotHtml ? (
            <article
              style={{ fontSize: `${Math.round(zoom * 100)}%` }}
              className="max-w-4xl mx-auto prose prose-sm md:prose-base dark:prose-invert leading-relaxed select-text"
              dangerouslySetInnerHTML={{ __html: renderedSnapshotHtml }}
            />
          ) : (
            <PlaneEmptyState
              variant="document"
              title="Empty snapshot content"
              description="This web snapshot does not contain any readable HTML content."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default EpubAndSnapshotViewer;
