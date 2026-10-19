'use client';

import { useState, useRef, useCallback } from 'react';
import type {
  ReaderAnnotation,
  AnnotationRect,
} from '@/features/library/domain/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import type { ActiveHighlightTooltipState } from './PageAnnotationOverlay';
import type { InlineTextInputState, AreaSelectionState } from './ViewerPageCanvas';

export interface UsePdfViewerInteractionParams {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  visiblePage: number;
  activeTool: ReaderAnnotationTool;
  activeColor?: string;
  interactionMode: 'select' | 'hand';
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area',
    comment?: string,
  ) => void;
}

export function usePdfViewerInteraction({
  scrollContainerRef,
  visiblePage,
  activeTool,
  activeColor,
  interactionMode,
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
  const [activeHighlightTooltip, setActiveHighlightTooltip] =
    useState<ActiveHighlightTooltipState | null>(null);

  const [inlineTextInput, setInlineTextInput] =
    useState<InlineTextInputState | null>(null);
  const [areaSelection, setAreaSelection] =
    useState<AreaSelectionState | null>(null);

  const areaSelectionRef = useRef<AreaSelectionState | null>(null);
  areaSelectionRef.current = areaSelection;
  const inlineTextInputRef = useRef<InlineTextInputState | null>(null);
  inlineTextInputRef.current = inlineTextInput;

  const handlePageMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (activeTool !== 'area' || e.button !== 0) return;
      e.preventDefault();
      const pageRect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX - pageRect.left;
      const startY = e.clientY - pageRect.top;
      setAreaSelection({
        pageNum,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        active: true,
      });
    },
    [activeTool],
  );

  const handlePageMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      const currArea = areaSelectionRef.current;
      if (!currArea?.active || currArea.pageNum !== pageNum) return;
      const pageRect = e.currentTarget.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(pageRect.width, e.clientX - pageRect.left));
      const currentY = Math.max(0, Math.min(pageRect.height, e.clientY - pageRect.top));
      setAreaSelection((prev) => (prev ? { ...prev, currentX, currentY } : null));
    },
    [],
  );

  const handlePageMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      const currArea = areaSelectionRef.current;
      if (!currArea?.active || currArea.pageNum !== pageNum) return;
      const pageRect = e.currentTarget.getBoundingClientRect();
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

        const rect: AnnotationRect = {
          x1: normX1,
          y1: normY1,
          x2: normX1 + normW,
          y2: normY1 + normH,
          width: normW,
          height: normH,
        };

        onAnnotate?.('', pageNum, activeColor || '#ffd400', [rect], 'rect');
      }
    },
    [activeColor, onAnnotate],
  );

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (activeTool === 'text') {
        const rect = e.currentTarget.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setInlineTextInput({ pageNum, normX, normY, text: '' });
        return;
      }

      if (activeTool === 'note') {
        const rect = e.currentTarget.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const noteRect: AnnotationRect = {
          x1: normX,
          y1: normY,
          x2: Math.min(1, normX + 0.03),
          y2: Math.min(1, normY + 0.03),
          width: 0.03,
          height: 0.03,
        };
        onAnnotate?.('', pageNum, activeColor || '#ffd400', [noteRect], 'note');
      }
    },
    [activeTool, activeColor, onAnnotate],
  );

  const handleSaveInlineText = useCallback(() => {
    const currInput = inlineTextInputRef.current;
    if (!currInput || !currInput.text.trim()) {
      setInlineTextInput(null);
      return;
    }
    const text = currInput.text.trim();
    const annotationRect: AnnotationRect = {
      x1: currInput.normX,
      y1: currInput.normY,
      x2: Math.min(1, currInput.normX + 0.25),
      y2: Math.min(1, currInput.normY + 0.04),
      width: 0.25,
      height: 0.04,
    };
    onAnnotate?.(text, currInput.pageNum, activeColor || '#ffd400', [annotationRect], 'text');
    setInlineTextInput(null);
  }, [activeColor, onAnnotate]);

  const openAnnotationCard = useCallback(
    (ann: ReaderAnnotation, el: HTMLElement) => {
      const target = el.getBoundingClientRect();
      const container = scrollContainerRef.current?.getBoundingClientRect();
      const top =
        target.bottom -
        (container?.top || 0) +
        (scrollContainerRef.current?.scrollTop || 0) +
        6;
      const left = Math.max(
        10,
        Math.min(
          (container?.width || 800) - 340,
          target.left -
            (container?.left || 0) +
            (scrollContainerRef.current?.scrollLeft || 0),
        ),
      );

      setActiveHighlightTooltip({
        id: ann.id,
        quote: ann.quoteText,
        comment: ann.comment,
        color: ann.color || '#ffd400',
        top,
        left,
        ann,
      });
    },
    [scrollContainerRef],
  );

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    const container = scrollContainerRef.current;
    if (!text || !container || !container.contains(selection.anchorNode)) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const menuHeight = 40;
      const menuGap = 10;
      const menuHalfWidth = 110;
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
      const left = Math.max(
        menuHalfWidth + menuGap,
        Math.min(
          rect.left - containerRect.left + rect.width / 2,
          container.clientWidth - menuHalfWidth - menuGap,
        ),
      );

      setMenuPosition({ top, left });
      setSelectedText(text);

      const anchorNode = selection.anchorNode;
      const anchorEl = (
        anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement
      ) as HTMLElement | null;
      const pageEl = anchorEl?.closest('[data-page-num]') as HTMLElement | null;
      const pNum = pageEl ? Number(pageEl.dataset.pageNum) : visiblePage;
      setSelectedPageNum(pNum);

      let relative: AnnotationRect[] = [];
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const clientRects = Array.from(range.getClientRects());
        relative = clientRects
          .map((cr) => {
            const x1 = Math.max(0, (cr.left - pageRect.left) / pageRect.width);
            const y1 = Math.max(0, (cr.top - pageRect.top) / pageRect.height);
            const width = Math.min(1 - x1, cr.width / pageRect.width);
            const height = Math.min(1 - y1, cr.height / pageRect.height);
            return { x1, y1, x2: x1 + width, y2: y1 + height, width, height };
          })
          .filter((r) => r.width > 0.001 && r.height > 0.001);
      }
      setSelectedRects(relative);

      if ((activeTool === 'highlight' || activeTool === 'underline') && onAnnotate) {
        onAnnotate(text, pNum, activeColor || '#ffd400', relative, activeTool);
        setShowFloatingMenu(false);
        window.getSelection()?.removeAllRanges();
        return;
      }

      setShowFloatingMenu(true);
    } catch {
      setShowFloatingMenu(false);
    }
  }, [scrollContainerRef, visiblePage, activeTool, activeColor, onAnnotate]);

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

  return {
    selectedText,
    menuPosition,
    showFloatingMenu,
    setShowFloatingMenu,
    selectedPageNum,
    selectedRects,
    activeHighlightTooltip,
    setActiveHighlightTooltip,
    inlineTextInput,
    setInlineTextInput,
    areaSelection,
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
