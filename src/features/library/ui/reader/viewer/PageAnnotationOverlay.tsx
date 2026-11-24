'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  MoreHorizontal,
  Plus,
  StickyNote,
  Tag,
  Trash2,
  Underline,
  X,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import type {
  ReaderAnnotation,
  AnnotationRect,
  ActiveHighlightTooltipState,
} from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import {
  ANNOTATION_PALETTE_COLORS,
  DEFAULT_ANNOTATION_COLOR,
} from '@/features/library/domain/reader/reader';
import { cropCanvasSelectionToDataUrl } from '@/features/library/domain/reader/search-outline';
import {
  normalizePageRotation,
  rotatePointFromCanonical,
  rotateRectFromCanonical,
  rotateRectToCanonical,
  splitVerticalOverlaps,
} from '@/features/library/domain/reader/annotation-geometry';

export type { ActiveHighlightTooltipState };

interface PageAnnotationOverlayProps {
  annotations: ReaderAnnotation[];
  rotation?: number;
  pulsingAnnotationId: string | null;
  activeAnnotationId?: string | null;
  activeTool?: ReaderAnnotationTool;
  isEraser?: boolean;
  onSelectAnnotation: (ann: ReaderAnnotation, el: HTMLElement) => void;
  onDeleteAnnotation?: (ann: ReaderAnnotation) => void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: {
      color?: string;
      comment?: string;
      tags?: string[];
      rects?: AnnotationRect[];
    },
  ) => Promise<unknown>;
}

type ResizeHandleCorner = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export const PageAnnotationOverlay = React.memo(function PageAnnotationOverlay({
  annotations,
  rotation = 0,
  pulsingAnnotationId,
  activeAnnotationId,
  activeTool,
  isEraser: isEraserProp,
  onSelectAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
}: PageAnnotationOverlayProps) {
  const normRot = normalizePageRotation(rotation);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [draggingRectState, setDraggingRectState] = useState<{
    annotationId: string;
    rectIdx: number;
    rect: AnnotationRect;
  } | null>(null);
  const [hoveredCommentAnn, setHoveredCommentAnn] = useState<{
    comment: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  if (!annotations || annotations.length === 0) return null;

  const isEraser = isEraserProp ?? activeTool === 'eraser';
  const recordMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleAnnotationInteraction = (
    e: React.MouseEvent<HTMLElement>,
    ann: ReaderAnnotation,
  ) => {
    if (!isEraser) {
      const startPos = mouseDownPosRef.current;
      mouseDownPosRef.current = null;
      if (startPos && Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y) > 4) {
        return;
      }
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        return;
      }
    }
    e.stopPropagation();
    if (isEraser && onDeleteAnnotation) {
      onDeleteAnnotation(ann);
      return;
    }
    onSelectAnnotation(ann, e.currentTarget);
  };

  const startRectDrag = (
    e: React.MouseEvent<HTMLElement>,
    ann: ReaderAnnotation,
    rectIdx: number,
    initialRect: AnnotationRect,
    mode: ResizeHandleCorner,
  ) => {
    if (isEraser || !onUpdateAnnotation) return;
    const container = overlayRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    e.stopPropagation();
    e.preventDefault();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const origX1 = initialRect.x1;
    const origY1 = initialRect.y1;
    const origW = Math.max(0.02, initialRect.width ?? (initialRect.x2 ?? initialRect.x1) - initialRect.x1);
    const origH = Math.max(0.02, initialRect.height ?? (initialRect.y2 ?? initialRect.y1) - initialRect.y1);
    let latestRect: AnnotationRect = { ...initialRect };
    let moved = false;

    const handleWindowMouseMove = (moveEvt: MouseEvent) => {
      const dx = (moveEvt.clientX - startMouseX) / bounds.width;
      const dy = (moveEvt.clientY - startMouseY) / bounds.height;
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) {
        moved = true;
      }

      let nextX1 = origX1;
      let nextY1 = origY1;
      let nextW = origW;
      let nextH = origH;

      if (mode === 'move') {
        nextX1 = Math.min(1 - origW, Math.max(0, origX1 + dx));
        nextY1 = Math.min(1 - origH, Math.max(0, origY1 + dy));
      } else {
        if (mode === 'nw' || mode === 'sw') {
          const maxLeft = origX1 + origW - 0.02;
          nextX1 = Math.min(maxLeft, Math.max(0, origX1 + dx));
          nextW = origX1 + origW - nextX1;
        } else {
          nextW = Math.min(1 - origX1, Math.max(0.02, origW + dx));
        }

        if (mode === 'nw' || mode === 'ne') {
          const maxTop = origY1 + origH - 0.02;
          nextY1 = Math.min(maxTop, Math.max(0, origY1 + dy));
          nextH = origY1 + origH - nextY1;
        } else {
          nextH = Math.min(1 - origY1, Math.max(0.02, origH + dy));
        }
      }

      latestRect = {
        ...initialRect,
        x1: Number(nextX1.toFixed(4)),
        y1: Number(nextY1.toFixed(4)),
        x2: Number((nextX1 + nextW).toFixed(4)),
        y2: Number((nextY1 + nextH).toFixed(4)),
        width: Number(nextW.toFixed(4)),
        height: Number(nextH.toFixed(4)),
      };
      setDraggingRectState({
        annotationId: ann.id,
        rectIdx,
        rect: latestRect,
      });
    };

    const cleanupListeners = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (dragCleanupRef.current === cleanupListeners) {
        dragCleanupRef.current = null;
      }
    };

    const handleWindowMouseUp = () => {
      cleanupListeners();
      setDraggingRectState(null);
      if (!moved) return;

      // Recrop imageDataUrl if a page canvas exists inside parent container
      const pageContainer = container.parentElement;
      const canvas = pageContainer?.querySelector('canvas') as HTMLCanvasElement | null;
      const croppedDataUrl = cropCanvasSelectionToDataUrl(canvas, latestRect);
      if (croppedDataUrl) {
        latestRect = {
          ...latestRect,
          imageDataUrl: croppedDataUrl,
        };
      }

      const canonicalRect = rotateRectToCanonical(latestRect, normRot);
      const existingRects = (Array.isArray(ann.rects) ? ann.rects : []) as AnnotationRect[];
      const nextRects = existingRects.map((item, idx) =>
        idx === rectIdx ? canonicalRect : item,
      );
      void onUpdateAnnotation(ann.id, ann.version, { rects: nextRects });
    };

    dragCleanupRef.current?.();
    dragCleanupRef.current = cleanupListeners;
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  return (
    <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {annotations.map((ann: ReaderAnnotation) => {
        const rects = (Array.isArray(ann.rects) ? ann.rects : []) as AnnotationRect[];
        const colorHex = ann.color || DEFAULT_ANNOTATION_COLOR;
        const isUnderline = ann.type === 'underline';
        const isStrike = ann.type === 'strike' || ann.type === 'strikethrough';
        const isRect = ann.type === 'rect' || ann.type === 'image' || ann.type === 'area';
        const isText = ann.type === 'text';
        const isNote = ann.type === 'note';
        const isInk = ann.type === 'ink';
        const isPulsing = pulsingAnnotationId === ann.id;

        // 0. Freehand Ink Annotation (SVG paths)
        if (isInk && rects.length > 0) {
          return rects.map((rawRect, rIdx) => {
            const r = rotateRectFromCanonical(rawRect, normRot);
            const paths = Array.isArray(r.paths) ? r.paths : [];
            const w = Math.max(0.01, r.width ?? (r.x2 ?? r.x1) - r.x1);
            const h = Math.max(0.01, r.height ?? (r.y2 ?? r.y1) - r.y1);
            return (
              <div
                key={`${ann.id}-${rIdx}`} id={rIdx === 0 ? `annotation-${ann.id}` : undefined} data-annotation-id={ann.id}
                className={cn(
                  'absolute pointer-events-auto z-20',
                  isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                  isPulsing && 'ring-2 ring-primary ring-offset-1',
                )}
                style={{ left: `${r.x1 * 100}%`, top: `${r.y1 * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
                onClick={(e) => handleAnnotationInteraction(e, ann)}
                onMouseEnter={(e) => { if (isEraser && e.buttons === 1 && onDeleteAnnotation) onDeleteAnnotation(ann); }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <g transform={normRot !== 0 ? `rotate(${normRot} 50 50)` : undefined}>
                    {paths.length > 0 ? (
                      paths.map((d, pIdx) => {
                        const isFilledOutline = d.trim().endsWith('Z');
                        return isFilledOutline ? (
                          <path key={pIdx} d={d} fill={colorHex} stroke="none" />
                        ) : (
                          <path key={pIdx} d={d} fill="none" stroke={colorHex} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        );
                      })
                    ) : (
                      <line x1="0" y1="0" x2="100" y2="100" stroke={colorHex} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                    )}
                  </g>
                </svg>
              </div>
            );
          });
        }

        // 1. Sticky Note Pin (Zotero 7 official)
        if (isNote && rects.length > 0) {
          const r = rects[0];
          const pt = rotatePointFromCanonical({ x: r.x1, y: r.y1 }, normRot);
          return (
            <div
              key={ann.id} id={`annotation-${ann.id}`} data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto z-20 group transition-colors focus-visible:outline-none',
                isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                isPulsing && 'ring-2 ring-primary ring-offset-2',
              )}
              style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, transform: 'translate(-50%, -50%)' }}
              onClick={(e) => handleAnnotationInteraction(e, ann)}
              onMouseEnter={(e) => { if (isEraser && e.buttons === 1 && onDeleteAnnotation) onDeleteAnnotation(ann); }}
            >
              <div className="size-5 rounded flex items-center justify-center border border-black/15" style={{ backgroundColor: colorHex }}>
                <StickyNote className="size-3 text-white fill-white/20" strokeWidth={2} />
              </div>
            </div>
          );
        }

        // 2. Floating Text Annotation
        if (isText && rects.length > 0) {
          const r = rects[0];
          const pt = rotatePointFromCanonical({ x: r.x1, y: r.y1 }, normRot);
          return (
            <div
              key={ann.id} id={`annotation-${ann.id}`} data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto text-11 font-sans font-medium px-2 py-1 rounded bg-background/95 border backdrop-blur-xs flex items-start gap-1.5 z-20 max-w-[260px]',
                isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                isPulsing && 'ring-2 ring-primary ring-offset-1',
              )}
              style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, borderColor: colorHex, color: colorHex }}
              onClick={(e) => handleAnnotationInteraction(e, ann)}
              onMouseEnter={(e) => { if (isEraser && e.buttons === 1 && onDeleteAnnotation) onDeleteAnnotation(ann); }}
            >
              <span className="size-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: colorHex }} />
              <span className="break-words whitespace-pre-wrap line-clamp-4 text-foreground font-normal leading-snug">
                {ann.quoteText || ann.text || ann.comment || 'Text'}
              </span>
            </div>
          );
        }

        // 3. Highlight / Underline / Strike / Rect (Area) Overlays
        if (rects.length > 0) {
          const isHighlight = !isRect && !isUnderline && !isStrike;
          const displayRectsRaw = rects.map((rawRect, rIdx) =>
            draggingRectState &&
            draggingRectState.annotationId === ann.id &&
            draggingRectState.rectIdx === rIdx
              ? { ...draggingRectState.rect }
              : rotateRectFromCanonical(rawRect, normRot),
          );

          const displayRects = isHighlight
            ? splitVerticalOverlaps(displayRectsRaw)
            : displayRectsRaw;

          if (isHighlight) {
            return (
              <div key={ann.id} id={`annotation-${ann.id}`} data-annotation-id={ann.id} className={cn('absolute inset-0 pointer-events-none', isPulsing && 'z-30')}>
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                  style={{ mixBlendMode: 'multiply', opacity: isPulsing ? 0.58 : 0.35 }}
                >
                  {displayRects.map((r, rIdx) => (
                    <div
                      key={`bg-${ann.id}-${rIdx}`} className="absolute rounded-[1px]"
                      style={{
                        left: `${r.x1 * 100}%`, top: `${r.y1 * 100}%`,
                        width: `${(r.width ?? (r.x2 ?? r.x1) - r.x1) * 100}%`,
                        height: `${(r.height ?? (r.y2 ?? r.y1) - r.y1) * 100}%`,
                        backgroundColor: colorHex,
                      }}
                    />
                  ))}
                </div>

                {displayRects.map((r, rIdx) => {
                  const isActive = activeAnnotationId === ann.id;
                  return (
                    <div
                      key={`hit-${ann.id}-${rIdx}`}
                      className={cn(
                        'absolute pointer-events-auto group/rect',
                        isEraser ? 'cursor-crosshair hover:bg-destructive/20' : 'cursor-pointer',
                        isActive && 'outline-1 outline-dashed outline-primary/80 z-20',
                      )}
                      style={{
                        left: `${r.x1 * 100}%`, top: `${r.y1 * 100}%`,
                        width: `${(r.width ?? (r.x2 ?? r.x1) - r.x1) * 100}%`,
                        height: `${(r.height ?? (r.y2 ?? r.y1) - r.y1) * 100}%`,
                      }}
                      onMouseDown={recordMouseDown}
                      onClick={(e) => handleAnnotationInteraction(e, ann)}
                      onMouseEnter={(e) => {
                        if (isEraser && e.buttons === 1 && onDeleteAnnotation) { onDeleteAnnotation(ann); return; }
                        if (ann.comment?.trim()) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const containerRect = overlayRef.current?.getBoundingClientRect();
                          if (containerRect) {
                            setHoveredCommentAnn({
                              comment: ann.comment.trim(),
                              x: rect.left - containerRect.left + rect.width / 2,
                              y: rect.top - containerRect.top - 6,
                            });
                          }
                        }
                      }}
                      onMouseLeave={() => setHoveredCommentAnn(null)}
                    >
                      {ann.comment?.trim() && rIdx === 0 && (
                        <span className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-1 ring-background pointer-events-none z-30 opacity-90 group-hover/rect:opacity-100">
                          <MessageSquare className="size-2 text-primary-foreground fill-current" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          return displayRects.map((r, rIdx) => {
            const passiveUnderline = isUnderline && !isEraser;
            const handleHoverEnter = (e: React.MouseEvent<HTMLElement>) => {
              if (isEraser && e.buttons === 1 && onDeleteAnnotation) { onDeleteAnnotation(ann); return; }
              if (ann.comment?.trim()) {
                const rect = e.currentTarget.getBoundingClientRect();
                const containerRect = overlayRef.current?.getBoundingClientRect();
                if (containerRect) {
                  setHoveredCommentAnn({
                    comment: ann.comment.trim(),
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top - 6,
                  });
                }
              }
            };

            return (
              <div
                key={`${ann.id}-${rIdx}`} id={rIdx === 0 ? `annotation-${ann.id}` : undefined} data-annotation-id={ann.id}
                className={cn(
                  'absolute group/rect',
                  passiveUnderline
                    ? 'pointer-events-none'
                    : cn(
                        'pointer-events-auto',
                        isEraser ? 'cursor-crosshair hover:opacity-40' : isRect && onUpdateAnnotation ? 'cursor-move' : 'cursor-pointer',
                      ),
                  isRect && 'border-2 rounded-sm',
                  isUnderline && 'border-b-2 rounded-none',
                  isStrike && "rounded-none after:content-[''] after:absolute after:left-0 after:right-0 after:top-1/2 after:-translate-y-1/2 after:border-t-2 after:border-current",
                  isPulsing && (isRect ? 'ring-1 ring-primary/60 z-30' : 'z-30'),
                )}
                style={{
                  left: `${r.x1 * 100}%`, top: `${r.y1 * 100}%`,
                  width: `${(r.width ?? (r.x2 ?? r.x1) - r.x1) * 100}%`,
                  height: `${(r.height ?? (r.y2 ?? r.y1) - r.y1) * 100}%`,
                  borderColor: isRect || isUnderline ? colorHex : undefined,
                  color: isStrike ? colorHex : undefined,
                  backgroundColor: isUnderline || isStrike ? (isPulsing ? `${colorHex}18` : 'transparent') : isRect ? `${colorHex}25` : colorHex,
                  opacity: isRect ? 0.95 : 1,
                }}
                onMouseDown={passiveUnderline ? undefined : (e) => {
                  if (isRect && !isEraser && onUpdateAnnotation) startRectDrag(e, ann, rIdx, r, 'move');
                  else recordMouseDown(e);
                }}
                onClick={passiveUnderline ? undefined : (e) => handleAnnotationInteraction(e, ann)}
                onMouseEnter={passiveUnderline ? undefined : handleHoverEnter}
                onMouseLeave={passiveUnderline ? undefined : () => setHoveredCommentAnn(null)}
              >
                {passiveUnderline && (
                  <span
                    className="absolute left-0 right-0 -bottom-[2px] h-[6px] pointer-events-auto cursor-pointer"
                    onMouseDown={recordMouseDown}
                    onClick={(e) => handleAnnotationInteraction(e, ann)}
                    onMouseEnter={handleHoverEnter}
                    onMouseLeave={() => setHoveredCommentAnn(null)}
                  />
                )}
              {ann.comment?.trim() && rIdx === 0 && !isRect && (
                <span className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-1 ring-background pointer-events-none z-30 opacity-90 group-hover/rect:opacity-100">
                  <MessageSquare className="size-2 text-primary-foreground fill-current" />
                </span>
              )}
              {isRect && (
                <>
                  <span className="absolute -top-3.5 left-0 px-1 py-0.5 text-[9px] font-mono rounded text-white font-semibold pointer-events-none" style={{ backgroundColor: colorHex }}>
                    Area
                  </span>
                  {!isEraser && onUpdateAnnotation && (
                    <>
                      <span role="presentation" onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'nw')} className="absolute -top-1 -left-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nwse-resize z-30" />
                      <span role="presentation" onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'ne')} className="absolute -top-1 -right-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nesw-resize z-30" />
                      <span role="presentation" onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'sw')} className="absolute -bottom-1 -left-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nesw-resize z-30" />
                      <span role="presentation" onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'se')} className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nwse-resize z-30" />
                    </>
                  )}
                </>
              )}
            </div>
            );
          });
        }

        return null;
      })}

      {hoveredCommentAnn && (
        <div
          className="absolute z-50 -translate-x-1/2 -translate-y-full pointer-events-none max-w-xs bg-popover/95 text-popover-foreground text-11 px-2.5 py-1.5 rounded-md shadow-raised-200 border border-border backdrop-blur-xs flex items-start gap-1.5 animate-in fade-in zoom-in-95 duration-75"
          style={{ left: `${hoveredCommentAnn.x}px`, top: `${hoveredCommentAnn.y}px` }}
        >
          <MessageSquare className="size-3 text-primary shrink-0 mt-0.5" />
          <span className="line-clamp-4 select-none font-sans leading-snug font-normal">{hoveredCommentAnn.comment}</span>
        </div>
      )}
    </div>
  );
});

interface AnnotationQuickEditCardProps {
  tooltip: ActiveHighlightTooltipState;
  visiblePage: number;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: {
      color?: string;
      comment?: string;
      tags?: string[];
      type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area';
    },
  ) => Promise<unknown>;
  onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  onAddToNote?: (text: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi?: (selectedText: string, pageNumber?: number) => void;
  onUpdateTooltip: React.Dispatch<React.SetStateAction<ActiveHighlightTooltipState | null>>;
  onClose: () => void;
}

export function AnnotationQuickEditCard({
  tooltip,
  visiblePage,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddToNote,
  onAskAi,
  onUpdateTooltip,
  onClose,
}: AnnotationQuickEditCardProps) {
  const [tooltipComment, setTooltipComment] = useState<string>(tooltip.comment || '');
  const [tagsList, setTagsList] = useState<string[]>(() => tooltip.ann.tags || []);
  const [isEditingComment, setIsEditingComment] = useState<boolean>(Boolean(tooltip.comment));
  const [isTagsExpanded, setIsTagsExpanded] = useState<boolean>(Boolean(tooltip.ann.tags && tooltip.ann.tags.length > 0));
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTooltipComment(tooltip.comment || '');
    setTagsList(tooltip.ann.tags || []);
    setIsEditingComment(Boolean(tooltip.comment));
    setIsTagsExpanded(Boolean(tooltip.ann.tags && tooltip.ann.tags.length > 0));
  }, [tooltip.id, tooltip.comment, tooltip.ann.tags]);

  const persistChanges = async (commentVal: string, tagsVal: string[]) => {
    const targetAnn = tooltip.ann;
    const trimmed = commentVal.trim();
    const commentUnchanged = (targetAnn.comment || '') === trimmed;
    const prevTags = targetAnn.tags || [];
    const tagsUnchanged =
      prevTags.length === tagsVal.length &&
      prevTags.every((t, idx) => t === tagsVal[idx]);

    if (commentUnchanged && tagsUnchanged) return;

    setIsSaving(true);
    try {
      let nextVersion =
        typeof targetAnn.version === 'number'
          ? targetAnn.version + 1
          : undefined;
      if (onUpdateAnnotation) {
        const updated = (await onUpdateAnnotation(
          targetAnn.id,
          targetAnn.version,
          { comment: trimmed, tags: tagsVal },
        )) as Partial<ReaderAnnotation> | undefined;
        if (typeof updated?.version === 'number') nextVersion = updated.version;
      }
      onUpdateTooltip((prev) =>
        prev
          ? {
              ...prev,
              comment: trimmed,
              ann: {
                ...prev.ann,
                comment: trimmed,
                tags: tagsVal,
                ...(nextVersion !== undefined ? { version: nextVersion } : {}),
              },
            }
          : null,
      );
    } catch {
      // Keep draft intact on transient error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCardCommentSave = async () => {
    await persistChanges(tooltipComment, tagsList);
    if (!tooltipComment.trim()) {
      setIsEditingComment(false);
    }
  };

  const handleAddTag = async () => {
    const cleaned = newTagInput.replace(/^#+/, '').trim();
    if (!cleaned) {
      setIsAddingTag(false);
      return;
    }
    if (!tagsList.includes(cleaned)) {
      const nextTags = [...tagsList, cleaned];
      setTagsList(nextTags);
      setNewTagInput('');
      await persistChanges(tooltipComment, nextTags);
    } else {
      setNewTagInput('');
    }
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = tagsList.filter((t) => t !== tagToRemove);
    setTagsList(nextTags);
    await persistChanges(tooltipComment, nextTags);
    if (nextTags.length === 0) {
      setIsTagsExpanded(false);
    }
  };

  const handleCardColorChange = async (colorHex: string) => {
    const targetAnn = tooltip.ann;
    const prevColor = tooltip.color;
    onUpdateTooltip((prev) => (prev ? { ...prev, color: colorHex } : null));
    if (onUpdateAnnotation) {
      try {
        const updated = (await onUpdateAnnotation(
          targetAnn.id,
          targetAnn.version,
          { color: colorHex },
        )) as Partial<ReaderAnnotation> | undefined;
        const nextVersion =
          typeof updated?.version === 'number'
            ? updated.version
            : typeof targetAnn.version === 'number'
              ? targetAnn.version + 1
              : undefined;
        onUpdateTooltip((prev) =>
          prev
            ? {
                ...prev,
                color: colorHex,
                ann: {
                  ...prev.ann,
                  color: colorHex,
                  ...(nextVersion !== undefined ? { version: nextVersion } : {}),
                },
              }
            : null,
        );
      } catch {
        onUpdateTooltip((prev) => (prev ? { ...prev, color: prevColor } : null));
      }
    }
  };

  const handleToggleAnnotationType = async () => {
    const targetAnn = tooltip.ann;
    const currentType = targetAnn.type || 'highlight';
    const nextType: 'highlight' | 'underline' =
      currentType === 'underline' ? 'highlight' : 'underline';
    if (onUpdateAnnotation) {
      await onUpdateAnnotation(targetAnn.id, targetAnn.version, {
        type: nextType,
      });
      onUpdateTooltip((prev) =>
        prev
          ? {
              ...prev,
              ann: { ...prev.ann, type: nextType },
            }
          : null,
      );
    }
  };

  const handleAddToNoteAction = () => {
    if (onAddToNote) {
      const text = tooltip.quote || tooltipComment || tooltip.comment || '';
      onAddToNote(text, pageNumber, tooltip.ann.id);
    }
  };

  const typeBadgeLetter = (() => {
    const t = tooltip.ann.type || 'highlight';
    if (t === 'underline') return 'U';
    if (t === 'note') return 'N';
    return 'A';
  })();

  const pageNumber =
    tooltip.ann.pageNumber ||
    (tooltip.ann.pageIndex !== undefined
      ? tooltip.ann.pageIndex + 1
      : visiblePage);
  const displayPageLabel = tooltip.ann.pageLabel?.trim() || String(pageNumber);

  return (
    <div
      className="absolute z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200 text-12 select-none w-64 max-w-[90vw] animate-in fade-in zoom-in-95 duration-100 font-sans"
      style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header: [Type Icon] Page X  ... (Options Menu) */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-4 rounded-xs flex items-center justify-center text-[10px] font-bold border shrink-0 transition-colors"
            style={{
              color: tooltip.color,
              borderColor: `${tooltip.color}90`,
              backgroundColor: `${tooltip.color}15`,
            }}
          >
            {typeBadgeLetter}
          </span>
          <span className="text-12 font-medium text-foreground truncate">
            Page {displayPageLabel}
          </span>
          {isSaving && (
            <Loader2 className="size-2.5 animate-spin text-muted-foreground ml-1" />
          )}
        </div>

        {/* ... More Options Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="More options"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-12 font-sans">
            {onAddToNote && (
              <>
                <DropdownMenuItem
                  onClick={handleAddToNoteAction}
                  className="gap-2 cursor-pointer"
                >
                  <StickyNote className="size-3.5 text-foreground" />
                  <span>Add to Note</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Color Palette (8 Zotero Colors with Checkmark on Active) */}
            {ANNOTATION_PALETTE_COLORS.map((c) => {
              const isSelected =
                (tooltip.color || DEFAULT_ANNOTATION_COLOR).toLowerCase() ===
                c.hex.toLowerCase();
              return (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => handleCardColorChange(c.hex)}
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-3.5 rounded-sm shrink-0 border border-black/15 dark:border-white/20"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="truncate">{c.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />

            {/* Convert between Highlight and Underline */}
            {(tooltip.ann.type === 'highlight' ||
              !tooltip.ann.type ||
              tooltip.ann.type === 'underline') && (
              <DropdownMenuItem
                onClick={handleToggleAnnotationType}
                className="gap-2 cursor-pointer"
              >
                <Underline className="size-3.5 text-foreground" />
                <span>
                  {tooltip.ann.type === 'underline'
                    ? 'Convert to Highlight'
                    : 'Convert to Underline'}
                </span>
              </DropdownMenuItem>
            )}

            {onDeleteAnnotation && (
              <DropdownMenuItem
                onClick={() => {
                  onDeleteAnnotation(tooltip.ann);
                  onClose();
                }}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Comment Area */}
      <div className="px-3 py-1">
        {isEditingComment || tooltipComment ? (
          <textarea
            ref={commentTextareaRef}
            rows={2}
            placeholder="Add comment..."
            value={tooltipComment}
            onChange={(e) => setTooltipComment(e.target.value)}
            onBlur={handleCardCommentSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleCardCommentSave();
              }
            }}
            className="w-full text-12 p-1.5 rounded border border-border/80 bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsEditingComment(true);
              setTimeout(() => commentTextareaRef.current?.focus(), 50);
            }}
            className="text-12 text-muted-foreground hover:text-foreground text-left py-1 cursor-pointer transition-colors block w-full"
          >
            Add comment
          </button>
        )}
      </div>

      {/* 3. Tags Area */}
      <div className="px-3 pb-2.5 pt-1 border-t border-border-subtle/50 mt-1">
        {!isTagsExpanded && tagsList.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              setIsTagsExpanded(true);
              setIsAddingTag(true);
            }}
            className="text-11 text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>Add tags...</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-11 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Tag className="size-3 text-orange-500" />
                <span>{tagsList.length} Tags</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="size-4.5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                title="Add tag"
              >
                <Plus className="size-3" />
              </button>
            </div>

            {tagsList.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {tagsList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-10 bg-muted text-foreground border border-border/60"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {(isAddingTag || tagsList.length === 0) && (
              <div className="flex items-center gap-1 pt-0.5">
                <Tag className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Tag name..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    } else if (e.key === 'Escape') {
                      setIsAddingTag(false);
                      setNewTagInput('');
                    }
                  }}
                  onBlur={() => {
                    if (newTagInput.trim()) {
                      handleAddTag();
                    } else if (tagsList.length > 0) {
                      setIsAddingTag(false);
                    }
                  }}
                  className="flex-1 text-11 px-1.5 py-0.5 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

