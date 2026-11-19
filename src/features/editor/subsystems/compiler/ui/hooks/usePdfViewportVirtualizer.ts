/**
 * usePdfViewportVirtualizer.ts
 *
 * IntersectionObserver viewport virtualization, ResizeObserver container width
 * tracking, and binary-search scroll/recompile-restoration state for PdfSurface.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  type PdfPageDimensions,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import {
  PDF_VIEWPORT_BUFFER_PAGES,
  PDF_SPREAD_VIEWPORT_BUFFER_PAGES,
  PDF_PINNED_TARGET_TTL_MS,
} from '@/features/editor/domain/constants/editor.constants';
import { logger } from '@/shared/lib/utils';
import { extractPageDimensionsPt } from '../OptimizedPdfPage';

export interface UsePdfViewportVirtualizerOptions {
  pdfUrl: string | null;
  numPages: number;
  scrollMode: boolean;
  isSpreadView: boolean;
  containerWidth?: number;
  effectivePageNumber: number;
  scale: number;
  perPageDimensions: Record<number, PdfPageDimensions>;
  effectiveDefaultDimensions: PdfPageDimensions;
  onScroll?: (info: { page: number; y: number; fraction: number }) => void;
  onNumPagesChange?: (num: number) => void;
  onDocumentLoadSuccess?: (pdf: { numPages: number }) => void;
  onPageDimensionsResolved: (pageNum: number, dims: PdfPageDimensions) => void;
}

export function usePdfViewportVirtualizer({
  pdfUrl,
  numPages,
  scrollMode,
  isSpreadView,
  containerWidth,
  effectivePageNumber,
  scale,
  perPageDimensions,
  effectiveDefaultDimensions,
  onScroll,
  onNumPagesChange,
  onDocumentLoadSuccess: parentOnLoadSuccess,
  onPageDimensionsResolved,
}: UsePdfViewportVirtualizerOptions) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const approxHeightRef = useRef<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([1, 2]));
  const [pinnedPage, setPinnedPage] = useState<number | null>(null);
  const pinnedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docLoadError, setDocLoadError] = useState<Error | null>(null);

  const scrollRafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isRestoringScrollRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (pinnedTimerRef.current) clearTimeout(pinnedTimerRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const pinTargetPage = useCallback((targetPage: number) => {
    if (!Number.isFinite(targetPage) || targetPage < 1) return;
    setPinnedPage(targetPage);
    if (pinnedTimerRef.current) clearTimeout(pinnedTimerRef.current);
    pinnedTimerRef.current = setTimeout(() => {
      setPinnedPage(null);
    }, PDF_PINNED_TARGET_TTL_MS);
  }, []);

  const registerPageShell = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    const prevEl = pageElemRefs.current[pageNum];
    if (prevEl && prevEl !== el) {
      observerRef.current?.unobserve(prevEl);
    }
    if (el) {
      pageElemRefs.current[pageNum] = el;
      if (prevEl !== el) {
        observerRef.current?.observe(el);
      }
    } else {
      delete pageElemRefs.current[pageNum];
    }
  }, []);

  useEffect(() => {
    if (
      !scrollMode ||
      numPages <= 0 ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.length === 0) return;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.boundingClientRect.height > 0) {
            approxHeightRef.current = entry.boundingClientRect.height;
          }
        }
        setVisiblePages((prev) => {
          let next: Set<number> | null = null;
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.pageNum);
            if (Number.isNaN(page) || page < 1) continue;
            const currentSet = next ?? prev;
            if (entry.isIntersecting) {
              if (!currentSet.has(page)) {
                if (!next) next = new Set(prev);
                next.add(page);
              }
            } else if (currentSet.has(page)) {
              if (!next) next = new Set(prev);
              next.delete(page);
            }
          }
          return next ?? prev;
        });
      },
      {
        root: container,
        rootMargin: '450px 0px 450px 0px',
        threshold: [0, 0.01, 0.25],
      },
    );

    observerRef.current = obs;
    Object.values(pageElemRefs.current).forEach((el) => {
      if (el) obs.observe(el);
    });

    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, [numPages, scrollMode, isSpreadView, pdfUrl]);

  useEffect(() => {
    setDocLoadError(null);
    if (lastScrollTopRef.current > 0) {
      isRestoringScrollRef.current = true;
    }
  }, [pdfUrl]);

  const pagePairs = useMemo(() => {
    if (!isSpreadView) return [];
    const pairs: number[][] = [];
    for (let i = 0; i < numPages; i += 2) {
      if (i + 1 < numPages) {
        pairs.push([i, i + 1]);
      } else {
        pairs.push([i]);
      }
    }
    return pairs;
  }, [numPages, isSpreadView]);

  const handleContainerScroll = useCallback(() => {
    if (
      !isRestoringScrollRef.current &&
      scrollContainerRef.current &&
      scrollContainerRef.current.scrollTop > 0
    ) {
      lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
    if (!onScroll) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollFocus = containerTop + containerHeight / 4;

      let low = 1;
      let high = numPages;
      let candidatePage = 1;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        const midEl = pageElemRefs.current[mid];
        if (!midEl) {
          break;
        }
        if (midEl.offsetTop <= scrollFocus) {
          candidatePage = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const checkPage = (p: number): boolean => {
        const el = pageElemRefs.current[p];
        if (!el) return false;
        const elTop = el.offsetTop;
        const elHeight = el.offsetHeight;
        if (scrollFocus >= elTop && scrollFocus <= elTop + elHeight) {
          const relativeY = scrollFocus - elTop;
          const pageDims = perPageDimensions[p] || effectiveDefaultDimensions;
          const widthPt = pageDims.widthPt > 0 ? pageDims.widthPt : DEFAULT_PDF_PAGE_WIDTH_PT;
          const effectiveScale = el.offsetWidth > 0 ? el.offsetWidth / widthPt : (scale > 0 ? scale : 1);
          const ptY = relativeY / effectiveScale;
          const fraction = elHeight > 0 ? relativeY / elHeight : 0;
          onScroll({ page: p, y: ptY, fraction });
          return true;
        }
        return false;
      };

      if (!checkPage(candidatePage) && !checkPage(candidatePage + 1)) {
        for (let p = 1; p <= numPages; p++) {
          const el = pageElemRefs.current[p];
          if (el && el.offsetTop > scrollFocus) break;
          if (checkPage(p)) break;
        }
      }
    });
  }, [onScroll, numPages, scale, perPageDimensions, effectiveDefaultDimensions]);

  const handleDocumentLoadSuccess = useCallback(
    (pdf: {
      numPages: number;
      getPage?: (pageNum: number) => Promise<{
        getViewport?: (params: { scale: number }) => { width?: number; height?: number };
        view?: number[];
        originalWidth?: number;
        originalHeight?: number;
      }>;
    }) => {
      const savedTop = lastScrollTopRef.current;
      if (typeof pdf.getPage === 'function' && pdf.numPages >= 1) {
        Promise.resolve(pdf.getPage(1))
          .then((page) => {
            if (page) {
              const dims = extractPageDimensionsPt(page);
              onPageDimensionsResolved(1, dims);
              (page as { cleanup?: () => void })?.cleanup?.();
            }
          })
          .catch(() => {});
      }
      queueMicrotask(() => {
        setDocLoadError(null);
        onNumPagesChange?.(pdf.numPages);
        parentOnLoadSuccess?.(pdf);

        if (savedTop > 0) {
          const restoreScroll = () => {
            if (scrollContainerRef.current && scrollContainerRef.current.scrollHeight > savedTop) {
              scrollContainerRef.current.scrollTop = savedTop;
              lastScrollTopRef.current = savedTop;
              isRestoringScrollRef.current = false;
            }
          };
          requestAnimationFrame(() => {
            restoreScroll();
            requestAnimationFrame(restoreScroll);
          });
          setTimeout(() => {
            restoreScroll();
            isRestoringScrollRef.current = false;
          }, 120);
        } else {
          isRestoringScrollRef.current = false;
        }
      });
    },
    [onNumPagesChange, parentOnLoadSuccess, onPageDimensionsResolved],
  );

  const handleDocumentLoadError = useCallback((error: unknown) => {
    logger.warn('[Surface] Document load error', { error });
    queueMicrotask(() => {
      setDocLoadError(
        error instanceof Error
          ? error
          : new Error(
              typeof error === 'object' && error !== null && 'message' in error
                ? String((error as { message: unknown }).message)
                : 'The compiled PDF document could not be decoded by the viewer engine.',
            ),
      );
    });
  }, []);

  const [containerWidthState, setContainerWidthState] = useState<number>(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const updateWidth = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (el.clientWidth > 0) {
          setContainerWidthState((prev) =>
            Math.abs(prev - el.clientWidth) >= 2 ? el.clientWidth : prev,
          );
        }
      });
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const currentContainerWidth =
    containerWidthState || containerWidth || scrollContainerRef.current?.clientWidth || 600;

  const inWindowPages = useMemo<Set<number>>(() => {
    const windowSet = new Set<number>();
    const maxPage = numPages > 0 ? numPages : 1;
    const buffer = isSpreadView ? PDF_SPREAD_VIEWPORT_BUFFER_PAGES : PDF_VIEWPORT_BUFFER_PAGES;
    const addWithBuffer = (center: number) => {
      if (center < 1 || center > maxPage) return;
      const start = Math.max(1, center - buffer);
      const end = Math.min(maxPage, center + buffer);
      for (let p = start; p <= end; p++) {
        windowSet.add(p);
      }
    };

    for (const p of visiblePages) {
      addWithBuffer(p);
    }
    if (windowSet.size === 0) {
      addWithBuffer(Math.min(maxPage, Math.max(1, effectivePageNumber)));
    }
    if (pinnedPage !== null) {
      addWithBuffer(pinnedPage);
    }
    return windowSet;
  }, [visiblePages, pinnedPage, effectivePageNumber, numPages, isSpreadView]);

  return {
    scrollContainerRef,
    pageElemRefs,
    approxHeightRef,
    docLoadError,
    currentContainerWidth,
    inWindowPages,
    pagePairs,
    registerPageShell,
    pinTargetPage,
    handleContainerScroll,
    handleDocumentLoadSuccess,
    handleDocumentLoadError,
  };
}
