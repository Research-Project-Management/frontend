'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ReaderAnnotation,
  AnnotationRect,
  ActiveHighlightTooltipState,
  InlineTextInputState,
  AreaSelectionState,
  InkDrawingState,
} from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { cropCanvasSelectionToDataUrl } from '@/features/library/domain/reader/search-outline';
import {
  calculatePointsBoundingBox,
  simplifyPointsRdp,
  getFreehandStrokePath,
} from '@/features/library/domain/reader/ink-canvas';
import { DEFAULT_ANNOTATION_COLOR } from '@/features/library/domain/reader/reader';
import {
  extractSelectionSegmentsByPage,
  normalizePdfSelectionText,
  rotatePointToCanonical,
  rotateRectToCanonical,
  type SelectionPageSegment,
} from '@/features/library/domain/reader/annotation-geometry';
import { searchReaderAttachmentAnchors } from '@/features/library/sdk/queries/reader.queries';

export { cropCanvasSelectionToDataUrl };

interface ViewerSearchAnchor {
  attachmentId?: string;
  pageIndex: number;
  snippet?: string;
  text?: string;
  charOffsetStart?: number;
  charOffsetEnd?: number;
  startOffset?: number;
  endOffset?: number;
  highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

export function useViewerSearchAnchors(
  attachmentId: string | undefined,
  debouncedQuery: string,
  spaceId?: string,
): ViewerSearchAnchor[] {
  const [matches, setMatches] = useState<ViewerSearchAnchor[]>([]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!attachmentId || trimmed.length < 2) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    searchReaderAttachmentAnchors(
      attachmentId,
      trimmed,
      undefined,
      spaceId,
      { signal: controller.signal },
    )
      .then((anchors: ViewerSearchAnchor[]) => {
        if (!controller.signal.aborted) {
          setMatches(Array.isArray(anchors) ? anchors : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMatches([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [attachmentId, spaceId, debouncedQuery]);

  return matches;
}

interface UsePdfViewerInteractionParams {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  visiblePage: number;
  activeTool: ReaderAnnotationTool;
  activeColor?: string;
  interactionMode: 'select' | 'hand';
  rotation?: number;
  isSuspended?: boolean;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area' | 'ink',
    comment?: string,
  ) => Promise<ReaderAnnotation | void | unknown> | void;
}

export function usePdfViewerInteraction({
  scrollContainerRef,
  visiblePage,
  activeTool,
  activeColor,
  interactionMode,
  rotation = 0,
  isSuspended = false,
  onAnnotate,
}: UsePdfViewerInteractionParams) {
  const [selectedText, setSelectedText] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [selectedRects, setSelectedRects] = useState<AnnotationRect[]>([]);
  const [selectedPageSegments, setSelectedPageSegments] = useState<SelectionPageSegment[]>([]);
  const [activeHighlightTooltip, setActiveHighlightTooltip] =
    useState<ActiveHighlightTooltipState | null>(null);

  const [inlineTextInput, setInlineTextInput] =
    useState<InlineTextInputState | null>(null);
  const [areaSelection, setAreaSelection] =
    useState<AreaSelectionState | null>(null);
  const [inkDrawing, setInkDrawing] =
    useState<InkDrawingState | null>(null);

  const areaSelectionRef = useRef<AreaSelectionState | null>(null);
  areaSelectionRef.current = areaSelection;
  const inkDrawingRef = useRef<InkDrawingState | null>(null);
  inkDrawingRef.current = inkDrawing;
  const inlineTextInputRef = useRef<InlineTextInputState | null>(null);
  inlineTextInputRef.current = inlineTextInput;

  const activePageRectRef = useRef<DOMRect | null>(null);
  const rafMoveIdRef = useRef<number | null>(null);
  const pendingInkPointsRef = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    return () => {
      if (rafMoveIdRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafMoveIdRef.current);
      }
    };
  }, []);

  const handlePageMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (e.button !== 0) return;

      if (activeTool === 'ink') {
        e.preventDefault();
        const pageRect = e.currentTarget.getBoundingClientRect();
        if (pageRect.width <= 0 || pageRect.height <= 0) return;
        activePageRectRef.current = pageRect;
        const normX = Math.max(0, Math.min(1, (e.clientX - pageRect.left) / pageRect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - pageRect.top) / pageRect.height));
        const initialPoints = [{ x: normX, y: normY }];
        pendingInkPointsRef.current = initialPoints;
        const nextInk: InkDrawingState = {
          pageNum,
          paths: [],
          currentPoints: initialPoints,
          active: true,
        };
        inkDrawingRef.current = nextInk;
        setInkDrawing(nextInk);
        return;
      }

      if (activeTool !== 'area') return;
      e.preventDefault();
      const pageRect = e.currentTarget.getBoundingClientRect();
      activePageRectRef.current = pageRect;
      const startX = e.clientX - pageRect.left;
      const startY = e.clientY - pageRect.top;
      const nextArea: AreaSelectionState = {
        pageNum,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        active: true,
      };
      areaSelectionRef.current = nextArea;
      setAreaSelection(nextArea);
    },
    [activeTool],
  );

  const handlePageMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      const currInk = inkDrawingRef.current;
      if (currInk?.active && currInk.pageNum === pageNum) {
        const pageRect = activePageRectRef.current ?? e.currentTarget.getBoundingClientRect();
        if (pageRect.width <= 0 || pageRect.height <= 0) return;
        const normX = Math.max(0, Math.min(1, (e.clientX - pageRect.left) / pageRect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - pageRect.top) / pageRect.height));
        pendingInkPointsRef.current.push({ x: normX, y: normY });
        inkDrawingRef.current = {
          ...currInk,
          currentPoints: pendingInkPointsRef.current,
        };
        if (rafMoveIdRef.current === null) {
          if (typeof requestAnimationFrame === 'function') {
            rafMoveIdRef.current = requestAnimationFrame(() => {
              rafMoveIdRef.current = null;
              if (inkDrawingRef.current?.active) {
                setInkDrawing({
                  ...inkDrawingRef.current,
                  currentPoints: [...pendingInkPointsRef.current],
                });
              }
            });
          } else {
            setInkDrawing({
              ...currInk,
              currentPoints: [...pendingInkPointsRef.current],
            });
          }
        }
        return;
      }

      const currArea = areaSelectionRef.current;
      if (!currArea?.active || currArea.pageNum !== pageNum) return;
      const pageRect = activePageRectRef.current ?? e.currentTarget.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(pageRect.width, e.clientX - pageRect.left));
      const currentY = Math.max(0, Math.min(pageRect.height, e.clientY - pageRect.top));
      const nextArea: AreaSelectionState = { ...currArea, currentX, currentY };
      areaSelectionRef.current = nextArea;
      if (rafMoveIdRef.current === null) {
        if (typeof requestAnimationFrame === 'function') {
          rafMoveIdRef.current = requestAnimationFrame(() => {
            rafMoveIdRef.current = null;
            if (areaSelectionRef.current?.active) {
              setAreaSelection({ ...areaSelectionRef.current });
            }
          });
        } else {
          setAreaSelection(nextArea);
        }
      }
    },
    [],
  );

  const handlePageMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (rafMoveIdRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafMoveIdRef.current);
        rafMoveIdRef.current = null;
      }

      const currInk = inkDrawingRef.current;
      if (currInk?.active && currInk.pageNum === pageNum) {
        const pts = pendingInkPointsRef.current.length > 0
          ? [...pendingInkPointsRef.current]
          : currInk.currentPoints;
        pendingInkPointsRef.current = [];
        inkDrawingRef.current = null;
        activePageRectRef.current = null;
        setInkDrawing(null);
        if (pts.length >= 2) {
          const simplified = simplifyPointsRdp(pts, 0.0006);
          const canonicalPts = simplified.map((pt) =>
            rotatePointToCanonical(pt, rotation),
          );
          const box = calculatePointsBoundingBox(canonicalPts, 0.005);
          const svgPath = getFreehandStrokePath(canonicalPts, box);
          const rect: AnnotationRect = {
            x1: box.x1,
            y1: box.y1,
            x2: box.x2,
            y2: box.y2,
            width: box.width,
            height: box.height,
            paths: [svgPath],
          };
          void onAnnotate?.('', pageNum, activeColor || DEFAULT_ANNOTATION_COLOR, [rect], 'ink');
        }
        return;
      }

      const currArea = areaSelectionRef.current;
      if (!currArea?.active || currArea.pageNum !== pageNum) return;
      const pageRect = activePageRectRef.current ?? e.currentTarget.getBoundingClientRect();
      activePageRectRef.current = null;
      areaSelectionRef.current = null;
      const xMin = Math.min(currArea.startX, currArea.currentX);
      const yMin = Math.min(currArea.startY, currArea.currentY);
      const widthPx = Math.abs(currArea.currentX - currArea.startX);
      const heightPx = Math.abs(currArea.currentY - currArea.startY);

      setAreaSelection(null);

      if (widthPx >= 16 && heightPx >= 16 && pageRect.width > 0 && pageRect.height > 0) {
        const normX1 = xMin / pageRect.width;
        const normY1 = yMin / pageRect.height;
        const normW = widthPx / pageRect.width;
        const normH = heightPx / pageRect.height;

        const canvasEl = e.currentTarget.querySelector('canvas');
        const imageDataUrl = cropCanvasSelectionToDataUrl(canvasEl, {
          x1: normX1,
          y1: normY1,
          width: normW,
          height: normH,
        });

        const rect = rotateRectToCanonical(
          {
            x1: normX1,
            y1: normY1,
            x2: normX1 + normW,
            y2: normY1 + normH,
            width: normW,
            height: normH,
            ...(imageDataUrl ? { imageDataUrl } : {}),
          },
          rotation,
        );

        void onAnnotate?.('', pageNum, activeColor || DEFAULT_ANNOTATION_COLOR, [rect], 'rect');
      }
    },
    [activeColor, onAnnotate, rotation],
  );

  const handlePageClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (activeTool === 'text') {
        const rect = e.currentTarget.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setInlineTextInput({ pageNum, normX, normY, text: '' });
        return;
      }

      if (activeTool === 'note') {
        const pageEl = e.currentTarget;
        const rect = pageEl.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const canonicalPt = rotatePointToCanonical({ x: normX, y: normY }, rotation);
        const noteRect: AnnotationRect = {
          x1: canonicalPt.x,
          y1: canonicalPt.y,
          x2: Math.min(1, canonicalPt.x + 0.03),
          y2: Math.min(1, canonicalPt.y + 0.03),
          width: 0.03,
          height: 0.03,
        };
        const clickX = e.clientX;
        const clickY = e.clientY;
        const created = await onAnnotate?.(
          '',
          pageNum,
          activeColor || DEFAULT_ANNOTATION_COLOR,
          [noteRect],
          'note',
        );
        if (created && typeof created === 'object' && 'id' in created) {
          const ann = created as ReaderAnnotation;
          const container = scrollContainerRef.current?.getBoundingClientRect();
          const top =
            clickY -
            (container?.top || 0) +
            (scrollContainerRef.current?.scrollTop || 0) +
            14;
          const left = Math.max(
            10,
            Math.min(
              (container?.width || 800) - 340,
              clickX -
                (container?.left || 0) +
                (scrollContainerRef.current?.scrollLeft || 0) -
                20,
            ),
          );
          setActiveHighlightTooltip({
            id: ann.id,
            quote: ann.quoteText,
            comment: ann.comment || '',
            color: ann.color || activeColor || DEFAULT_ANNOTATION_COLOR,
            top,
            left,
            ann,
          });
        }
      }
    },
    [activeTool, activeColor, onAnnotate, rotation, scrollContainerRef],
  );

  const handleSaveInlineText = useCallback(() => {
    const currInput = inlineTextInputRef.current;
    if (!currInput || !currInput.text.trim()) {
      setInlineTextInput(null);
      return;
    }
    const text = currInput.text.trim();
    const canonicalPt = rotatePointToCanonical(
      { x: currInput.normX, y: currInput.normY },
      rotation,
    );
    const annotationRect: AnnotationRect = {
      x1: canonicalPt.x,
      y1: canonicalPt.y,
      x2: Math.min(1, canonicalPt.x + 0.25),
      y2: Math.min(1, canonicalPt.y + 0.04),
      width: 0.25,
      height: 0.04,
    };
    onAnnotate?.(text, currInput.pageNum, activeColor || DEFAULT_ANNOTATION_COLOR, [annotationRect], 'text');
    setInlineTextInput(null);
  }, [activeColor, onAnnotate, rotation]);

  const openAnnotationCard = useCallback(
    (ann: ReaderAnnotation, el?: HTMLElement) => {
      const container = scrollContainerRef.current?.getBoundingClientRect();
      const containerWidth = container?.width || 800;
      const maxLeft = Math.max(12, containerWidth - 304);
      let top = 0;
      let left = 0;
      if (el) {
        const target = el.getBoundingClientRect();
        top =
          target.bottom -
          (container?.top || 0) +
          (scrollContainerRef.current?.scrollTop || 0) +
          6;
        left = Math.max(
          12,
          Math.min(
            maxLeft,
            target.left -
              (container?.left || 0) +
              (scrollContainerRef.current?.scrollLeft || 0),
          ),
        );
      } else {
        top = (menuPosition.top || 100) + 10;
        left = Math.max(
          12,
          Math.min(maxLeft, (menuPosition.left || 200) - 144),
        );
      }

      setActiveHighlightTooltip({
        id: ann.id,
        quote: ann.quoteText,
        comment: ann.comment,
        color: ann.color || DEFAULT_ANNOTATION_COLOR,
        top,
        left,
        ann,
      });
    },
    [scrollContainerRef, menuPosition],
  );

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = normalizePdfSelectionText(selection.toString());
    const container = scrollContainerRef.current;
    if (!text || !container || !container.contains(selection.anchorNode)) return;

    try {
      const range = selection.getRangeAt(0);
      const clientRects = Array.from(range.getClientRects()).filter(
        (cr) => cr.width > 1 && cr.height > 1,
      );
      const rect = range.getBoundingClientRect();
      const firstLineRect = clientRects[0] || rect;
      const containerRect = container.getBoundingClientRect();
      const menuHeight = 36;
      const menuGap = 12;
      const menuHalfWidth = 240;
      const selectionTop = rect.top - containerRect.top + container.scrollTop;
      const selectionBottom = rect.bottom - containerRect.top + container.scrollTop;
      const visibleTop = container.scrollTop + menuGap;
      const visibleBottom = container.scrollTop + container.clientHeight - menuHeight - menuGap;
      const preferredTop = selectionTop - menuHeight - menuGap;
      const fallbackTop = selectionBottom + menuGap;
      const top = Math.max(
        visibleTop,
        Math.min(preferredTop >= visibleTop ? preferredTop : fallbackTop, visibleBottom),
      );
      const anchorCenterX =
        firstLineRect.left - containerRect.left + firstLineRect.width / 2;
      const left = Math.max(
        menuHalfWidth + menuGap,
        Math.min(
          anchorCenterX,
          container.clientWidth - menuHalfWidth - menuGap,
        ),
      );

      setMenuPosition({ top, left });
      setSelectedText(text);

      const segments = extractSelectionSegmentsByPage(
        range,
        container,
        text,
        visiblePage,
        rotation,
      );
      const primarySegment = segments[0];
      const pNum = primarySegment ? primarySegment.pageNum : visiblePage;
      const relative = primarySegment ? primarySegment.rects : [];
      setSelectedPageSegments(segments);
      setSelectedPageNum(pNum);
      setSelectedRects(relative);

      if ((activeTool === 'highlight' || activeTool === 'underline') && onAnnotate) {
        const colorToUse = activeColor || DEFAULT_ANNOTATION_COLOR;
        const targets =
          segments.length > 0
            ? segments
            : [{ pageNum: pNum, text, rects: relative }];
        for (const seg of targets) {
          void onAnnotate(seg.text, seg.pageNum, colorToUse, seg.rects, activeTool);
        }
        setShowFloatingMenu(false);
        setSelectedPageSegments([]);
        window.getSelection()?.removeAllRanges();
        return;
      }

      setShowFloatingMenu(true);
    } catch {
      setShowFloatingMenu(false);
    }
  }, [scrollContainerRef, visiblePage, activeTool, activeColor, rotation, onAnnotate]);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode === 'hand') {
        isPanningRef.current = true;
        if (scrollContainerRef.current) {
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: scrollContainerRef.current.scrollLeft,
            scrollTop: scrollContainerRef.current.scrollTop,
          };
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (!target.closest('.pdf-floating-selection-menu')) {
        setShowFloatingMenu(false);
      }
    },
    [interactionMode, scrollContainerRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode === 'hand' && isPanningRef.current && scrollContainerRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
        scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      }
    },
    [interactionMode, scrollContainerRef],
  );

  const handleMouseUpCombined = useCallback(() => {
    if (interactionMode === 'hand') {
      isPanningRef.current = false;
      return;
    }
    handleMouseUp();
  }, [interactionMode, handleMouseUp]);

  useEffect(() => {
    if (isSuspended) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFloatingMenu(false);
        setActiveHighlightTooltip(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSuspended]);

  return {
    selectedText,
    menuPosition,
    showFloatingMenu,
    setShowFloatingMenu,
    selectedPageNum,
    selectedRects,
    selectedPageSegments,
    activeHighlightTooltip,
    setActiveHighlightTooltip,
    inlineTextInput,
    setInlineTextInput,
    areaSelection,
    inkDrawing,
    handlePageMouseDown,
    handlePageMouseMove,
    handlePageMouseUp,
    handlePageClick,
    handleSaveInlineText,
    openAnnotationCard,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpCombined,
  };
}
