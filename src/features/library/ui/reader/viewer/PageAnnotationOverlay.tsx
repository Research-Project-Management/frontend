'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Trash2, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  ReaderAnnotation,
  AnnotationRect,
  ActiveHighlightTooltipState,
} from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/ui/reader/ReaderToolbar';
import { cropCanvasSelectionToDataUrl } from '@/features/library/domain/reader-search-outline.domain';

export type { ActiveHighlightTooltipState };

interface PageAnnotationOverlayProps {
  annotations: ReaderAnnotation[];
  pulsingAnnotationId: string | null;
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
  pulsingAnnotationId,
  activeTool,
  isEraser: isEraserProp,
  onSelectAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
}: PageAnnotationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [draggingRectState, setDraggingRectState] = useState<{
    annotationId: string;
    rectIdx: number;
    rect: AnnotationRect;
  } | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  if (!annotations || annotations.length === 0) return null;

  const isEraser = isEraserProp ?? activeTool === 'eraser';
  const handleAnnotationInteraction = (
    e: React.MouseEvent<HTMLElement>,
    ann: ReaderAnnotation,
  ) => {
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

      const existingRects = (Array.isArray(ann.rects) ? ann.rects : []) as AnnotationRect[];
      const nextRects = existingRects.map((item, idx) => (idx === rectIdx ? latestRect : item));
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
        const colorHex = ann.color || '#ffd400';
        const isUnderline = ann.type === 'underline';
        const isStrike = ann.type === 'strike' || ann.type === 'strikethrough';
        const isRect = ann.type === 'rect' || ann.type === 'image' || ann.type === 'area';
        const isText = ann.type === 'text';
        const isNote = ann.type === 'note';
        const isInk = ann.type === 'ink';
        const isPulsing = pulsingAnnotationId === ann.id;

        // 0. Freehand Ink Annotation (SVG paths)
        if (isInk && rects.length > 0) {
          return rects.map((r, rIdx) => {
            const paths = Array.isArray(r.paths) ? r.paths : [];
            const w = Math.max(0.01, r.width ?? (r.x2 ?? r.x1) - r.x1);
            const h = Math.max(0.01, r.height ?? (r.y2 ?? r.y1) - r.y1);
            return (
              <div
                key={`${ann.id}-${rIdx}`}
                id={rIdx === 0 ? `annotation-${ann.id}` : undefined}
                data-annotation-id={ann.id}
                className={cn(
                  'absolute pointer-events-auto z-20 transition-all',
                  isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                  isPulsing && 'ring-2 ring-primary ring-offset-1',
                )}
                style={{
                  left: `${r.x1 * 100}%`,
                  top: `${r.y1 * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                }}
                onClick={(e) => handleAnnotationInteraction(e, ann)}
                onMouseEnter={(e) => {
                  if (isEraser && e.buttons === 1 && onDeleteAnnotation) {
                    onDeleteAnnotation(ann);
                  }
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible"
                >
                  {paths.length > 0 ? (
                    paths.map((d, pIdx) => (
                      <path
                        key={pIdx}
                        d={d}
                        fill="none"
                        stroke={colorHex}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))
                  ) : (
                    <line
                      x1="0"
                      y1="0"
                      x2="100"
                      y2="100"
                      stroke={colorHex}
                      strokeWidth={2.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>
            );
          });
        }

        // 1. Sticky Note Pin (Zotero 7 official)
        if (isNote && rects.length > 0) {
          const r = rects[0];
          return (
            <div
              key={ann.id}
              id={`annotation-${ann.id}`}
              data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto z-20 group transition-colors focus-visible:outline-none',
                isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                isPulsing && 'ring-2 ring-primary ring-offset-2',
              )}
              style={{
                left: `${r.x1 * 100}%`,
                top: `${r.y1 * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => handleAnnotationInteraction(e, ann)}
              onMouseEnter={(e) => {
                if (isEraser && e.buttons === 1 && onDeleteAnnotation) {
                  onDeleteAnnotation(ann);
                }
              }}
            >
              <div
                className="size-5 rounded flex items-center justify-center border border-black/15 transition-all"
                style={{ backgroundColor: colorHex }}
                title={ann.comment || 'Sticky Note'}
              >
                <StickyNote className="size-3 text-white fill-white/20" strokeWidth={2} />
              </div>
            </div>
          );
        }

        // 2. Floating Text Annotation
        if (isText && rects.length > 0) {
          const r = rects[0];
          return (
            <div
              key={ann.id}
              id={`annotation-${ann.id}`}
              data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto text-11 font-sans font-medium px-2 py-1 rounded bg-background/95 border backdrop-blur-xs flex items-start gap-1.5 z-20 transition-all max-w-[260px]',
                isEraser ? 'cursor-crosshair hover:opacity-50' : 'cursor-pointer',
                isPulsing && 'ring-2 ring-primary ring-offset-1',
              )}
              style={{
                left: `${r.x1 * 100}%`,
                top: `${r.y1 * 100}%`,
                borderColor: colorHex,
                color: colorHex,
              }}
              onClick={(e) => handleAnnotationInteraction(e, ann)}
              onMouseEnter={(e) => {
                if (isEraser && e.buttons === 1 && onDeleteAnnotation) {
                  onDeleteAnnotation(ann);
                }
              }}
            >
              <span
                className="size-1.5 rounded-full shrink-0 mt-1.5"
                style={{ backgroundColor: colorHex }}
              />
              <span className="break-words whitespace-pre-wrap line-clamp-4 text-foreground font-normal leading-snug">
                {ann.quoteText || ann.text || ann.comment || 'Text'}
              </span>
            </div>
          );
        }

        // 3. Highlight / Underline / Strike / Rect (Area) Overlays
        if (rects.length > 0) {
          return rects.map((rawRect, rIdx) => {
            const r =
              draggingRectState &&
              draggingRectState.annotationId === ann.id &&
              draggingRectState.rectIdx === rIdx
                ? draggingRectState.rect
                : rawRect;
            return (
              <div
                key={`${ann.id}-${rIdx}`}
                id={rIdx === 0 ? `annotation-${ann.id}` : undefined}
                data-annotation-id={ann.id}
                className={cn(
                  'absolute pointer-events-auto transition-all group/rect',
                  isEraser
                    ? 'cursor-crosshair hover:opacity-40'
                    : isRect && onUpdateAnnotation
                      ? 'cursor-move'
                      : 'cursor-pointer',
                  isRect && 'border-2 rounded-sm',
                  isUnderline && 'border-b-2 rounded-none',
                  isStrike &&
                    "rounded-none after:content-[''] after:absolute after:left-0 after:right-0 after:top-1/2 after:-translate-y-1/2 after:border-t-2 after:border-current",
                  !isRect && !isUnderline && !isStrike && 'rounded-[2px] hover:opacity-75',
                  isPulsing && 'ring-2 ring-primary ring-offset-1 z-30',
                )}
                style={{
                  left: `${r.x1 * 100}%`,
                  top: `${r.y1 * 100}%`,
                  width: `${(r.width ?? (r.x2 ?? r.x1) - r.x1) * 100}%`,
                  height: `${(r.height ?? (r.y2 ?? r.y1) - r.y1) * 100}%`,
                  borderColor: isRect || isUnderline ? colorHex : undefined,
                  color: isStrike ? colorHex : undefined,
                  backgroundColor:
                    isUnderline || isStrike
                      ? 'transparent'
                      : isRect
                        ? `${colorHex}25`
                        : colorHex,
                  opacity: isRect ? 0.95 : isUnderline || isStrike ? 1 : 0.38,
                  mixBlendMode: isRect || isUnderline || isStrike ? 'normal' : 'multiply',
                }}
                onMouseDown={(e) => {
                  if (isRect && !isEraser && onUpdateAnnotation) {
                    startRectDrag(e, ann, rIdx, r, 'move');
                  }
                }}
                onClick={(e) => handleAnnotationInteraction(e, ann)}
                onMouseEnter={(e) => {
                  if (isEraser && e.buttons === 1 && onDeleteAnnotation) {
                    onDeleteAnnotation(ann);
                  }
                }}
              >
                {isRect && (
                  <>
                    <span
                      className="absolute -top-3.5 left-0 px-1 py-0.5 text-[9px] font-mono rounded text-white font-semibold pointer-events-none"
                      style={{ backgroundColor: colorHex }}
                    >
                      Area
                    </span>
                    {!isEraser && onUpdateAnnotation && (
                      <>
                        <span
                          role="presentation"
                          onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'nw')}
                          className="absolute -top-1 -left-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nwse-resize z-30"
                        />
                        <span
                          role="presentation"
                          onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'ne')}
                          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nesw-resize z-30"
                        />
                        <span
                          role="presentation"
                          onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'sw')}
                          className="absolute -bottom-1 -left-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nesw-resize z-30"
                        />
                        <span
                          role="presentation"
                          onMouseDown={(e) => startRectDrag(e, ann, rIdx, r, 'se')}
                          className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-background border border-foreground opacity-0 group-hover/rect:opacity-100 cursor-nwse-resize z-30"
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            );
          });
        }

        // Annotations without coordinates are listed in the sidebar, never rendered at arbitrary page coordinates
        return null;
      })}
    </div>
  );
});

interface AnnotationQuickEditCardProps {
  tooltip: ActiveHighlightTooltipState;
  visiblePage: number;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[] },
  ) => Promise<unknown>;
  onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  onAddToNote?: (selectedText: string, pageNumber?: number, annotationId?: string) => void;
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
  const [tooltipTagsInput, setTooltipTagsInput] = useState<string>(
    () => (tooltip.ann.tags || []).map((t) => `#${t}`).join(' '),
  );
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);

  useEffect(() => {
    setTooltipComment(tooltip.comment || '');
    setTooltipTagsInput((tooltip.ann.tags || []).map((t) => `#${t}`).join(' '));
  }, [tooltip.id, tooltip.comment, tooltip.ann.tags]);

  const handleCardColorChange = async (colorHex: string) => {
    const targetAnn = tooltip.ann;
    const prevColor = tooltip.color;
    onUpdateTooltip((prev) => (prev ? { ...prev, color: colorHex } : null));
    if (onUpdateAnnotation) {
      try {
        const updated = (await onUpdateAnnotation(targetAnn.id, targetAnn.version, {
          color: colorHex,
        })) as Partial<ReaderAnnotation> | undefined;
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

  const handleCardCommentSave = async () => {
    const targetAnn = tooltip.ann;
    const trimmed = tooltipComment.trim();
    const parsedTags = Array.from(
      new Set(
        tooltipTagsInput
          .split(/[\s,;]+/)
          .map((t) => t.replace(/^#+/, '').trim())
          .filter(Boolean),
      ),
    );
    const prevTags = targetAnn.tags || [];
    const commentUnchanged = (targetAnn.comment || '') === trimmed;
    const tagsUnchanged =
      prevTags.length === parsedTags.length &&
      prevTags.every((t, idx) => t === parsedTags[idx]);
    if (commentUnchanged && tagsUnchanged) return;

    setIsSavingComment(true);
    try {
      let nextVersion =
        typeof targetAnn.version === 'number' ? targetAnn.version + 1 : undefined;
      if (onUpdateAnnotation) {
        const updated = (await onUpdateAnnotation(targetAnn.id, targetAnn.version, {
          comment: trimmed,
          tags: parsedTags,
        })) as Partial<ReaderAnnotation> | undefined;
        if (typeof updated?.version === 'number') {
          nextVersion = updated.version;
        }
      }
      onUpdateTooltip((prev) =>
        prev
          ? {
              ...prev,
              comment: trimmed,
              ann: {
                ...prev.ann,
                comment: trimmed,
                tags: parsedTags,
                ...(nextVersion !== undefined ? { version: nextVersion } : {}),
              },
            }
          : null,
      );
    } catch {
      // Keep draft comment intact so user does not lose text on transient failure
    } finally {
      setIsSavingComment(false);
    }
  };

  const typeLabel = (() => {
    const t = tooltip.ann.type || 'highlight';
    if (t === 'note') return 'Sticky Note';
    if (t === 'underline') return 'Underline';
    if (t === 'strike' || t === 'strikethrough') return 'Strikethrough';
    if (t === 'rect' || t === 'area' || t === 'image') return 'Area';
    if (t === 'ink') return 'Freehand Ink';
    if (t === 'text') return 'Text';
    return 'Highlight';
  })();

  const pageNumber =
    tooltip.ann.pageNumber ||
    (tooltip.ann.pageIndex !== undefined ? tooltip.ann.pageIndex + 1 : visiblePage);
  const displayPageLabel = tooltip.ann.pageLabel?.trim() || String(pageNumber);

  return (
    <div
      className="absolute z-50 rounded-md border border-border bg-background p-2.5 shadow-raised-200 text-12 select-none w-72 max-w-[90vw] animate-in fade-in zoom-in-95 duration-100 font-sans"
      style={{
        top: `${tooltip.top}px`,
        left: `${tooltip.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header: Type Badge, Page, & Action Buttons */}
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: tooltip.color }}
          />
          <span className="text-11 font-semibold text-foreground">{typeLabel}</span>
          <span className="text-10 text-muted-foreground font-mono">p. {displayPageLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onAskAi && (tooltip.quote || tooltipComment || tooltip.comment) && (
            <button
              type="button"
              onClick={() => {
                onAskAi(tooltip.quote || tooltipComment || tooltip.comment || '', pageNumber);
                onClose();
              }}
              className="size-6 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title="Ask AI"
              aria-label="Ask AI"
            >
              <img
                src="/Chat.svg"
                alt="AI Assistant"
                className="size-3.5 rounded-full object-cover shrink-0"
              />
            </button>
          )}
          {onAddToNote && (
            <button
              type="button"
              onClick={() => {
                onAddToNote(tooltip.quote || tooltipComment || tooltip.comment || '', pageNumber, tooltip.ann.id);
                onClose();
              }}
              className="size-6 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title="Add to Note"
              aria-label="Add to Note"
            >
              <StickyNote className="size-3.5 shrink-0" strokeWidth={1.5} />
            </button>
          )}
          {onDeleteAnnotation && (
            <button
              type="button"
              onClick={() => {
                onDeleteAnnotation(tooltip.ann);
                onClose();
              }}
              className="size-6 rounded-md text-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title="Delete annotation"
              aria-label="Delete annotation"
            >
              <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="size-6 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Close"
            aria-label="Close"
          >
            <X className="size-3.5 shrink-0" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 2. Standard 8-Color Annotation Palette Picker */}
      <div className="flex items-center justify-between gap-1 pb-2 border-b border-border-subtle">
        <span className="text-10 font-medium text-muted-foreground">Color:</span>
        <div className="flex items-center gap-1">
          {ANNOTATION_PALETTE_COLORS.map((c) => {
            const isSelected = (tooltip.color || '#ffd400').toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Change to ${c.label}`}
                title={c.label}
                onClick={() => handleCardColorChange(c.hex)}
                className={cn(
                  'size-3.5 rounded-full border border-border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2.5 md:before:hidden',
                  isSelected && 'ring-2 ring-primary ring-offset-1',
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Quote Block (if exists) */}
      {tooltip.quote && (
        <div className="my-2 px-2 py-1.5 rounded-sm bg-muted/60 border border-border-subtle flex items-start gap-1.5">
          <span className="w-1 self-stretch rounded-full shrink-0 my-0.5" style={{ backgroundColor: tooltip.color }} />
          <p className="text-11 leading-snug text-foreground italic select-text line-clamp-4">&ldquo;{tooltip.quote}&rdquo;</p>
        </div>
      )}

      {/* 4. Editable Comment / Note Section */}
      <div className="space-y-1 mt-2">
        <div className="flex items-center justify-between text-10 text-muted-foreground font-medium">
          <span>Comment</span>
          {isSavingComment && (
            <span className="text-primary flex items-center gap-0.5 text-10">
              <Loader2 className="size-2.5 animate-spin" /> Saving...
            </span>
          )}
        </div>
        <textarea
          rows={2}
          placeholder="Add comment or thought..."
          value={tooltipComment}
          onChange={(e) => setTooltipComment(e.target.value)}
          onBlur={handleCardCommentSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCardCommentSave();
            }
          }}
          className="w-full text-11 p-1.5 rounded border border-border bg-muted text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed"
        />
      </div>

      {/* 5. Editable Tags */}
      <div className="space-y-1 mt-2 pt-1.5 border-t border-border-subtle">
        <span className="text-10 text-muted-foreground font-medium block">Tags</span>
        <input
          type="text"
          placeholder="Add #tags (space or comma separated)..."
          value={tooltipTagsInput}
          onChange={(e) => setTooltipTagsInput(e.target.value)}
          onBlur={handleCardCommentSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCardCommentSave();
            }
          }}
          className="w-full text-11 px-1.5 py-1 rounded border border-border bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>
    </div>
  );
}

