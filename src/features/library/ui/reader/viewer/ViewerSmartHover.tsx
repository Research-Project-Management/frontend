'use client';

import { useState, useRef, useMemo, useCallback, type RefObject, useEffect } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  arrow,
  autoUpdate,
} from '@floating-ui/react';
import type { DocumentFulltext } from '@/features/library/types/reader.types';
import {
  extractPdfPageHoverGeometry,
  normalizePageRotation,
  rotateRectFromCanonical,
  type PdfPageHoverGeometry,
  type PdfPageProxyLike,
} from '@/features/library/domain/reader/annotation-geometry';
import {
  AUTHOR_YEAR_CITATION_RE,
  buildSemanticLookupIndex,
  buildSemanticPageOverlays,
  hitTestSemanticOverlays,
  refineSemanticOverlaysWithTextLayer,
  type SemanticOverlayEntry,
  type SemanticPageOverlay,
} from '@/features/library/domain/reader/semantic-overlays';
import { cn } from '@/shared/lib/utils';

export { TextSelectionToolbar } from './TextSelectionToolbar';
export { AUTHOR_YEAR_CITATION_RE };

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 500;

export type SmartHoverEntry = SemanticOverlayEntry;

export interface SmartHoverCardData {
  kind: 'Reference' | 'Figure' | 'Table' | 'Section' | 'Link';
  entries: SmartHoverEntry[];
  anchorRect: { left: number; top: number; width: number; height: number };
}

function getAnchorRectForHit(
  hit: SemanticPageOverlay,
  normX: number,
  normY: number,
  rotation: number,
  pageRect: DOMRect,
  containerRect: DOMRect,
  container: HTMLDivElement,
): SmartHoverCardData['anchorRect'] {
  const normRot = normalizePageRotation(rotation);
  const rotatedRects = hit.rects.map((r) =>
    rotateRectFromCanonical({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 }, normRot),
  );
  const tol = 0.004;
  const targetRect =
    rotatedRects.find(
      (r) =>
        normX >= r.x1 - tol &&
        normX <= r.x2 + tol &&
        normY >= r.y1 - tol &&
        normY <= r.y2 + tol,
    ) ?? rotatedRects[0]!;

  return {
    left:
      pageRect.left +
      targetRect.x1 * pageRect.width -
      containerRect.left +
      container.scrollLeft,
    top:
      pageRect.top +
      targetRect.y1 * pageRect.height -
      containerRect.top +
      container.scrollTop,
    width: (targetRect.x2 - targetRect.x1) * pageRect.width,
    height: (targetRect.y2 - targetRect.y1) * pageRect.height,
  };
}

export function useViewerSmartHover({
  fulltext,
  numPages,
  scrollContainerRef,
  pdfDocument,
  rotation = 0,
  visiblePage,
  onNavigatePage,
}: {
  fulltext?: DocumentFulltext | null;
  numPages: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pdfDocument?: {
    getPage?: (pageNumber: number) => Promise<PdfPageProxyLike>;
  } | null;
  rotation?: number;
  visiblePage?: number;
  onNavigatePage?: (pageNumber: number) => void;
}) {
  const [smartHoverCard, setSmartHoverCard] = useState<SmartHoverCardData | null>(null);
  const [overlaysByPage, setOverlaysByPage] = useState<Record<number, SemanticPageOverlay[]>>({});
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);

  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTriggerKeyRef = useRef<string | null>(null);
  const isHoveringPopoverRef = useRef<boolean>(false);

  const overlaysByPageRef = useRef<Record<number, SemanticPageOverlay[]>>({});
  overlaysByPageRef.current = overlaysByPage;

  const smartHoverCardRef = useRef<SmartHoverCardData | null>(null);
  smartHoverCardRef.current = smartHoverCard;

  const canonicalGeometryCacheRef = useRef<Map<number, PdfPageHoverGeometry>>(new Map());
  const pendingPageLoadsRef = useRef<Set<number>>(new Set());
  const computedRevisionByPageRef = useRef<Map<number, number>>(new Map());
  const textLayerRefineTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const lookupRevisionRef = useRef(0);
  const activePdfDocRef = useRef(pdfDocument);
  activePdfDocRef.current = pdfDocument;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  const hoverLookupIndex = useMemo(() => {
    lookupRevisionRef.current += 1;
    return buildSemanticLookupIndex(fulltext, numPages);
  }, [fulltext, numPages]);

  const hoverLookupRef = useRef(hoverLookupIndex);
  hoverLookupRef.current = hoverLookupIndex;

  const cancelHoverOpen = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    lastTriggerKeyRef.current = null;
  }, []);

  const cancelHoverDismiss = useCallback(() => {
    if (hoverDismissTimerRef.current) {
      clearTimeout(hoverDismissTimerRef.current);
      hoverDismissTimerRef.current = null;
    }
  }, []);

  const scheduleDismissSmartHover = useCallback(() => {
    cancelHoverOpen();
    if (hoverDismissTimerRef.current) return;
    hoverDismissTimerRef.current = setTimeout(() => {
      hoverDismissTimerRef.current = null;
      if (!isHoveringPopoverRef.current) {
        setHoveredOverlayId(null);
        setSmartHoverCard(null);
      }
    }, CLOSE_DELAY_MS);
  }, [cancelHoverOpen]);

  const clearRefineTimers = useCallback(() => {
    for (const timer of textLayerRefineTimersRef.current.values()) {
      clearTimeout(timer);
    }
    textLayerRefineTimersRef.current.clear();
  }, []);

  const scheduleTextLayerRefinement = useCallback(
    (pageNum: number, rev: number, attempt = 0) => {
      const existingTimer = textLayerRefineTimersRef.current.get(pageNum);
      if (existingTimer) {
        clearTimeout(existingTimer);
        textLayerRefineTimersRef.current.delete(pageNum);
      }
      const delayMs = attempt === 0 ? 250 : 600;
      const timer = setTimeout(() => {
        textLayerRefineTimersRef.current.delete(pageNum);
        if (computedRevisionByPageRef.current.get(pageNum) !== rev) return;
        const current = overlaysByPageRef.current[pageNum];
        if (!current || current.length === 0) return;

        const pageEl =
          scrollContainerRef.current?.querySelector<HTMLElement>(
            `[data-page-num="${pageNum}"]`,
          ) ?? null;
        const hasSpans = Boolean(
          pageEl?.querySelector(
            '.react-pdf__Page__textLayer span, .react-pdf__Page__textContent span, .textLayer span',
          ),
        );
        if (!pageEl || !hasSpans) {
          if (attempt < 2) {
            scheduleTextLayerRefinement(pageNum, rev, attempt + 1);
          }
          return;
        }

        const normRot = normalizePageRotation(rotationRef.current);
        const refined = refineSemanticOverlaysWithTextLayer(pageEl, current, normRot);
        if (refined !== current) {
          setOverlaysByPage((prev) => {
            if (prev[pageNum] !== current) return prev;
            return { ...prev, [pageNum]: refined };
          });
        }
      }, delayMs);
      textLayerRefineTimersRef.current.set(pageNum, timer);
    },
    [scrollContainerRef],
  );

  const commitPageOverlays = useCallback(
    (pageNum: number, geometry: PdfPageHoverGeometry, rev: number) => {
      const built = buildSemanticPageOverlays(pageNum, geometry, hoverLookupRef.current);
      const pageEl =
        scrollContainerRef.current?.querySelector<HTMLElement>(
          `[data-page-num="${pageNum}"]`,
        ) ?? null;
      const normRot = normalizePageRotation(rotationRef.current);
      const refined = refineSemanticOverlaysWithTextLayer(pageEl, built, normRot);

      computedRevisionByPageRef.current.set(pageNum, rev);
      setOverlaysByPage((prev) => {
        if (prev[pageNum] === refined) return prev;
        return { ...prev, [pageNum]: refined };
      });

      const needsTextLayerSnap = built.some(
        (o) => o.source === 'matched' && o.rects.length === 1,
      );
      if (needsTextLayerSnap) {
        const hasSpans = Boolean(
          pageEl?.querySelector(
            '.react-pdf__Page__textLayer span, .react-pdf__Page__textContent span, .textLayer span',
          ),
        );
        if (!hasSpans) {
          scheduleTextLayerRefinement(pageNum, rev, 0);
        }
      }
    },
    [scrollContainerRef, scheduleTextLayerRefinement],
  );

  const ensurePageOverlaysComputed = useCallback(
    (pageNum: number) => {
      const getPageFn = pdfDocument?.getPage;
      if (
        !Number.isFinite(pageNum) ||
        pageNum < 1 ||
        (numPages > 0 && pageNum > numPages) ||
        !pdfDocument ||
        typeof getPageFn !== 'function' ||
        !fulltext
      ) {
        return;
      }

      const rev = lookupRevisionRef.current;
      if (computedRevisionByPageRef.current.get(pageNum) === rev) {
        return;
      }

      const cachedGeo = canonicalGeometryCacheRef.current.get(pageNum);
      if (cachedGeo) {
        commitPageOverlays(pageNum, cachedGeo, rev);
        return;
      }

      if (pendingPageLoadsRef.current.has(pageNum)) {
        return;
      }

      pendingPageLoadsRef.current.add(pageNum);
      const docSnapshot = pdfDocument;
      void getPageFn
        .call(docSnapshot, pageNum)
        .then((page) => extractPdfPageHoverGeometry(page, 0))
        .then((geometry) => {
          if (activePdfDocRef.current !== docSnapshot) return;
          canonicalGeometryCacheRef.current.set(pageNum, geometry);
          commitPageOverlays(pageNum, geometry, lookupRevisionRef.current);
        })
        .catch(() => undefined)
        .finally(() => {
          pendingPageLoadsRef.current.delete(pageNum);
        });
    },
    [pdfDocument, fulltext, numPages, commitPageOverlays],
  );

  // Reset caches when switching documents
  useEffect(() => {
    canonicalGeometryCacheRef.current.clear();
    pendingPageLoadsRef.current.clear();
    computedRevisionByPageRef.current.clear();
    clearRefineTimers();
    overlaysByPageRef.current = {};
    setOverlaysByPage({});
    setHoveredOverlayId(null);
    cancelHoverOpen();
    cancelHoverDismiss();
    setSmartHoverCard(null);
  }, [pdfDocument, cancelHoverOpen, cancelHoverDismiss, clearRefineTimers]);

  // When fulltext lookup index updates (e.g. bibliography finishes loading), recompute cached pages immediately
  useEffect(() => {
    if (!fulltext || !pdfDocument) return;
    const rev = lookupRevisionRef.current;
    computedRevisionByPageRef.current.clear();
    for (const [pageNum, geometry] of canonicalGeometryCacheRef.current.entries()) {
      commitPageOverlays(pageNum, geometry, rev);
    }
  }, [hoverLookupIndex, fulltext, pdfDocument, commitPageOverlays]);

  // Pre-warm nearby pages [visiblePage - 1 .. visiblePage + 2]
  useEffect(() => {
    if (!fulltext || !pdfDocument || !visiblePage || visiblePage < 1) return;
    const candidates = [visiblePage - 1, visiblePage, visiblePage + 1, visiblePage + 2];
    for (const pageNum of candidates) {
      if (pageNum >= 1 && (numPages <= 0 || pageNum <= numPages)) {
        ensurePageOverlaysComputed(pageNum);
      }
    }
  }, [fulltext, pdfDocument, visiblePage, numPages, ensurePageOverlaysComputed]);

  useEffect(() => {
    return () => {
      cancelHoverOpen();
      cancelHoverDismiss();
      clearRefineTimers();
    };
  }, [cancelHoverOpen, cancelHoverDismiss, clearRefineTimers]);

  useEffect(() => {
    if (!smartHoverCard) return;
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        cancelHoverOpen();
        cancelHoverDismiss();
        setHoveredOverlayId(null);
        setSmartHoverCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [smartHoverCard, cancelHoverOpen, cancelHoverDismiss]);

  const evaluateSmartHoverAtEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!fulltext) return;
      if (e.buttons !== 0) {
        setHoveredOverlayId(null);
        cancelHoverOpen();
        return;
      }

      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        setHoveredOverlayId(null);
        cancelHoverOpen();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-smart-hover-popover]')) {
        cancelHoverDismiss();
        return;
      }
      if (target.closest('[data-pdf-external-link]')) {
        cancelHoverDismiss();
        return;
      }

      const pageEl = target.closest('[data-page-num]') as HTMLElement | null;
      const pageNum = pageEl ? Number(pageEl.dataset.pageNum) : NaN;
      const container = scrollContainerRef.current;

      if (!pageEl || !Number.isFinite(pageNum) || pageNum < 1 || !container) {
        setHoveredOverlayId((prev) => (prev !== null ? null : prev));
        cancelHoverOpen();
        if (smartHoverCardRef.current) {
          scheduleDismissSmartHover();
        }
        return;
      }

      const pageOverlays = overlaysByPageRef.current[pageNum];
      if (!pageOverlays) {
        ensurePageOverlaysComputed(pageNum);
        setHoveredOverlayId((prev) => (prev !== null ? null : prev));
        cancelHoverOpen();
        if (smartHoverCardRef.current) {
          scheduleDismissSmartHover();
        }
        return;
      }

      const pageRect = pageEl.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) return;

      const normX = (e.clientX - pageRect.left) / pageRect.width;
      const normY = (e.clientY - pageRect.top) / pageRect.height;
      const hit = hitTestSemanticOverlays(pageOverlays, normX, normY, rotation);

      if (!hit) {
        setHoveredOverlayId((prev) => (prev !== null ? null : prev));
        cancelHoverOpen();
        if (smartHoverCardRef.current) {
          scheduleDismissSmartHover();
        }
        return;
      }

      setHoveredOverlayId((prev) => (prev === hit.id ? prev : hit.id));
      cancelHoverDismiss();

      if (
        lastTriggerKeyRef.current === hit.id &&
        (hoverOpenTimerRef.current || smartHoverCardRef.current)
      ) {
        return;
      }

      cancelHoverOpen();
      lastTriggerKeyRef.current = hit.id;

      const containerRect = container.getBoundingClientRect();
      const anchorRect = getAnchorRectForHit(
        hit,
        normX,
        normY,
        rotation,
        pageRect,
        containerRect,
        container,
      );

      const nextCard: SmartHoverCardData = {
        kind: hit.kind,
        entries: hit.entries,
        anchorRect,
      };
      hoverOpenTimerRef.current = setTimeout(() => {
        hoverOpenTimerRef.current = null;
        setSmartHoverCard(nextCard);
      }, OPEN_DELAY_MS);
    },
    [
      fulltext,
      rotation,
      scrollContainerRef,
      ensurePageOverlaysComputed,
      cancelHoverOpen,
      cancelHoverDismiss,
      scheduleDismissSmartHover,
    ],
  );

  const handleContainerMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      evaluateSmartHoverAtEvent(e);
    },
    [evaluateSmartHoverAtEvent],
  );

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      evaluateSmartHoverAtEvent(e);
    },
    [evaluateSmartHoverAtEvent],
  );

  const setPopoverHovered = useCallback((hovered: boolean) => {
    isHoveringPopoverRef.current = hovered;
  }, []);

  const handlePageOverlayClick = useCallback(
    (e: React.MouseEvent, pageNum: number): boolean => {
      if (e.defaultPrevented) return false;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('[data-pdf-external-link], a')) {
        return false;
      }

      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        return false;
      }

      const pageOverlays = overlaysByPageRef.current[pageNum];
      if (!pageOverlays || pageOverlays.length === 0) return false;

      const pageRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) return false;

      const normX = (e.clientX - pageRect.left) / pageRect.width;
      const normY = (e.clientY - pageRect.top) / pageRect.height;
      const hit = hitTestSemanticOverlays(pageOverlays, normX, normY, rotation);
      if (!hit) return false;

      const targetPage =
        hit.entries[0]?.targetPage ??
        hit.entries.find((entry) => typeof entry.targetPage === 'number' && entry.targetPage >= 1)
          ?.targetPage;
      if (typeof targetPage !== 'number' || !Number.isFinite(targetPage) || targetPage < 1) {
        return false;
      }

      cancelHoverOpen();
      cancelHoverDismiss();
      setHoveredOverlayId(null);
      setSmartHoverCard(null);
      onNavigatePage?.(targetPage);
      return true;
    },
    [rotation, cancelHoverOpen, cancelHoverDismiss, onNavigatePage],
  );

  const showExternalLinkPopup = useCallback(
    ({ url, rect }: { url: string; rect: DOMRect }) => {
      const container = scrollContainerRef.current;
      if (!container || !url) return;

      const triggerKey = `ext:${url}:${Math.round(rect.left)}:${Math.round(rect.top)}`;
      if (
        lastTriggerKeyRef.current === triggerKey &&
        (hoverOpenTimerRef.current || smartHoverCardRef.current)
      ) {
        cancelHoverDismiss();
        return;
      }

      cancelHoverDismiss();
      cancelHoverOpen();
      setHoveredOverlayId(null);

      lastTriggerKeyRef.current = triggerKey;

      const containerRect = container.getBoundingClientRect();
      const anchorRect = {
        left: rect.left - containerRect.left + container.scrollLeft,
        top: rect.top - containerRect.top + container.scrollTop,
        width: rect.width,
        height: rect.height,
      };

      const nextCard: SmartHoverCardData = {
        kind: 'Link',
        entries: [{ badge: 'External Link', rawFallback: url, externalUrl: url }],
        anchorRect,
      };

      hoverOpenTimerRef.current = setTimeout(() => {
        hoverOpenTimerRef.current = null;
        setSmartHoverCard(nextCard);
      }, OPEN_DELAY_MS);
    },
    [scrollContainerRef, cancelHoverDismiss, cancelHoverOpen],
  );

  return {
    smartHoverCard,
    hoverCard: smartHoverCard,
    overlaysByPage,
    hoveredOverlayId,
    setSmartHoverCard,
    setPopoverHovered,
    showExternalLinkPopup,
    cancelHoverOpen,
    cancelHoverDismiss,
    scheduleDismissSmartHover,
    handleContainerMouseOver,
    handleContainerMouseMove,
    handlePageOverlayClick,
  };
}

export function ViewerSmartHoverPopover({
  card,
  onCancelDismiss,
  onScheduleDismiss,
  onPopoverHoverChange,
}: {
  card: SmartHoverCardData;
  onCancelDismiss: () => void;
  onScheduleDismiss: () => void;
  onPopoverHoverChange?: (hovered: boolean) => void;
  onDismiss?: () => void;
  onJumpToPage?: (page: number) => void;
  onOpenInSplitView?: (page: number) => void;
}) {
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const { refs, floatingStyles, placement, middlewareData } = useFloating({
    placement: 'bottom',
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      arrow({ element: arrowRef, padding: 14 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const isTopPlacement = placement.startsWith('top');
  const arrowX = middlewareData.arrow?.x;

  const formatEntryLine = (entry: SmartHoverEntry): string => {
    if (entry.rawFallback) return entry.rawFallback;
    const segments: string[] = [];
    if (entry.authors) segments.push(entry.authors.replace(/\.+$/, ''));
    if (entry.title) segments.push(entry.title.replace(/\.+$/, ''));
    if (entry.venueYear) segments.push(entry.venueYear.replace(/\.+$/, ''));
    return segments.length > 0 ? `${segments.join('. ')}.` : entry.badge;
  };

  return (
    <>
      <div
        ref={refs.setReference}
        aria-hidden="true"
        className="absolute pointer-events-none z-[6]"
        style={{
          left: card.anchorRect.left,
          top: card.anchorRect.top,
          width: card.anchorRect.width,
          height: card.anchorRect.height,
        }}
      />
      <div
        ref={refs.setFloating}
        data-smart-hover-popover="true"
        role="status"
        aria-label={`${card.kind} preview`}
        onMouseEnter={() => {
          onPopoverHoverChange?.(true);
          onCancelDismiss();
        }}
        onMouseLeave={() => {
          onPopoverHoverChange?.(false);
          onScheduleDismiss();
        }}
        style={floatingStyles}
        className="z-40 w-[360px] max-w-[90vw] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200 px-3.5 py-2.5 font-sans animate-in fade-in duration-100 select-text"
      >
        <span
          ref={arrowRef}
          aria-hidden="true"
          style={arrowX !== undefined ? { left: `${arrowX}px` } : undefined}
          className={cn(
            'absolute size-2.5 rotate-45 border-border bg-popover pointer-events-none',
            isTopPlacement
              ? '-bottom-[5px] border-r border-b'
              : '-top-[5px] border-l border-t',
          )}
        />
        <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle">
          {card.entries.map((entry, idx) => {
            const text = formatEntryLine(entry);
            return (
              <div
                key={`${entry.badge}-${idx}`}
                className={cn(
                  card.entries.length > 1 && idx > 0 && 'pt-2',
                  card.entries.length > 1 && idx < card.entries.length - 1 && 'pb-2',
                )}
              >
                <p className="text-[12px] leading-[1.55] text-foreground">
                  {card.entries.length > 1 && (
                    <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                      {entry.badge}
                    </span>
                  )}
                  {entry.externalUrl ? (
                    <a
                      href={entry.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {text}
                    </a>
                  ) : (
                    <span>{text}</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
