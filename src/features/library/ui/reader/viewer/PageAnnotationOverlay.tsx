'use client';

import React, { useState, useEffect } from 'react';
import { StickyNote, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ReaderAnnotation, AnnotationRect } from '@/features/library/domain/types/reader.types';
import { ZOTERO_COLORS } from '@/features/library/ui/reader/ReaderToolbar';

export interface ActiveHighlightTooltipState {
  id: string;
  quote?: string;
  comment?: string;
  color?: string;
  top: number;
  left: number;
  ann: ReaderAnnotation;
}

export interface PageAnnotationOverlayProps {
  annotations: ReaderAnnotation[];
  pulsingAnnotationId: string | null;
  onSelectAnnotation: (ann: ReaderAnnotation, el: HTMLElement) => void;
}

export function PageAnnotationOverlay({
  annotations,
  pulsingAnnotationId,
  onSelectAnnotation,
}: PageAnnotationOverlayProps) {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {annotations.map((ann: ReaderAnnotation) => {
        const rects = (Array.isArray(ann.rects) ? ann.rects : []) as AnnotationRect[];
        const colorHex = ann.color || '#ffd400';
        const isUnderline = ann.type === 'underline';
        const isRect = ann.type === 'rect' || ann.type === 'image' || ann.type === 'area';
        const isText = ann.type === 'text';
        const isNote = ann.type === 'note';
        const isPulsing = pulsingAnnotationId === ann.id;

        // 1. Sticky Note Pin (Zotero 7 official)
        if (isNote && rects.length > 0) {
          const r = rects[0];
          return (
            <div
              key={ann.id}
              id={`annotation-${ann.id}`}
              data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto cursor-pointer z-20 group transition-transform hover:scale-125 focus-visible:outline-none',
                isPulsing && 'ring-4 ring-primary ring-offset-2 animate-pulse scale-125',
              )}
              style={{
                left: `${r.x1 * 100}%`,
                top: `${r.y1 * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(ann, e.currentTarget);
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
                'absolute pointer-events-auto cursor-pointer text-11 font-sans font-medium px-1.5 py-0.5 rounded bg-background/95 border backdrop-blur-xs flex items-center gap-1 z-20 transition-all',
                isPulsing && 'ring-4 ring-primary ring-offset-1 animate-pulse',
              )}
              style={{
                left: `${r.x1 * 100}%`,
                top: `${r.y1 * 100}%`,
                borderColor: colorHex,
                color: colorHex,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(ann, e.currentTarget);
              }}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: colorHex }}
              />
              <span className="truncate max-w-[140px] text-foreground font-normal">
                {ann.quoteText || ann.comment || 'Text'}
              </span>
            </div>
          );
        }

        // 3. Highlight / Underline / Rect (Area) Overlays
        if (rects.length > 0) {
          return rects.map((r, rIdx) => (
            <div
              key={`${ann.id}-${rIdx}`}
              id={`annotation-${ann.id}`}
              data-annotation-id={ann.id}
              className={cn(
                'absolute pointer-events-auto transition-all cursor-pointer',
                isRect && 'border-2 rounded-sm',
                isUnderline && 'border-b-2 rounded-none',
                !isRect && !isUnderline && 'rounded-[2px] hover:opacity-75',
                isPulsing && 'ring-4 ring-primary ring-offset-1 animate-pulse z-30 shadow-md',
              )}
              style={{
                left: `${r.x1 * 100}%`,
                top: `${r.y1 * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
                borderColor: isRect || isUnderline ? colorHex : undefined,
                backgroundColor: isUnderline
                  ? 'transparent'
                  : isRect
                    ? `${colorHex}25`
                    : colorHex,
                opacity: isRect ? 0.95 : isUnderline ? 1 : 0.38,
                mixBlendMode: isRect || isUnderline ? 'normal' : 'multiply',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(ann, e.currentTarget);
              }}
            >
              {isRect && (
                <span
                  className="absolute -top-3.5 left-0 px-1 py-0.2 text-9 font-mono rounded text-white font-semibold pointer-events-none"
                  style={{ backgroundColor: colorHex }}
                >
                  Area
                </span>
              )}
            </div>
          ));
        }

        // Fallback chip if no rects stored yet
        return (
          <div
            key={ann.id}
            id={`annotation-${ann.id}`}
            data-annotation-id={ann.id}
            className={cn(
              'absolute top-2 left-2 z-20 pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md text-10 font-mono border shadow-none cursor-pointer bg-background/85 backdrop-blur-xs',
              isPulsing && 'ring-4 ring-primary ring-offset-1 animate-pulse',
            )}
            style={{ borderColor: colorHex }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAnnotation(ann, e.currentTarget);
            }}
          >
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: colorHex }} />
            <span className="truncate max-w-[120px] text-foreground">
              {ann.quoteText || 'Highlight'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface AnnotationQuickEditCardProps {
  tooltip: ActiveHighlightTooltipState;
  visiblePage: number;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[] },
  ) => Promise<unknown>;
  onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  onAddToNote?: (selectedText: string, pageNumber?: number, annotationId?: string) => void;
  onUpdateTooltip: React.Dispatch<React.SetStateAction<ActiveHighlightTooltipState | null>>;
  onClose: () => void;
}

export function AnnotationQuickEditCard({
  tooltip,
  visiblePage,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddToNote,
  onUpdateTooltip,
  onClose,
}: AnnotationQuickEditCardProps) {
  const [tooltipComment, setTooltipComment] = useState<string>(tooltip.comment || '');
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);

  useEffect(() => {
    setTooltipComment(tooltip.comment || '');
  }, [tooltip.id, tooltip.comment]);

  const handleCardColorChange = async (colorHex: string) => {
    const targetAnn = tooltip.ann;
    onUpdateTooltip((prev) => (prev ? { ...prev, color: colorHex } : null));
    if (onUpdateAnnotation) {
      await onUpdateAnnotation(targetAnn.id, targetAnn.version, { color: colorHex });
    }
  };

  const handleCardCommentSave = async () => {
    const targetAnn = tooltip.ann;
    if ((targetAnn.comment || '') === tooltipComment.trim()) return;
    setIsSavingComment(true);
    try {
      if (onUpdateAnnotation) {
        await onUpdateAnnotation(targetAnn.id, targetAnn.version, {
          comment: tooltipComment.trim(),
        });
      }
      onUpdateTooltip((prev) => (prev ? { ...prev, comment: tooltipComment.trim() } : null));
    } finally {
      setIsSavingComment(false);
    }
  };

  const typeLabel = (() => {
    const t = tooltip.ann.type || 'highlight';
    if (t === 'note') return 'Sticky Note';
    if (t === 'underline') return 'Underline';
    if (t === 'rect' || t === 'area' || t === 'image') return 'Area';
    if (t === 'text') return 'Text';
    return 'Highlight';
  })();

  const pageLabel =
    tooltip.ann.pageNumber ||
    (tooltip.ann.pageIndex !== undefined ? tooltip.ann.pageIndex + 1 : visiblePage);

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
          <span className="text-10 text-muted-foreground font-mono">p. {pageLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onAddToNote && (
            <button
              type="button"
              onClick={() => {
                onAddToNote(
                  tooltip.quote || tooltipComment || tooltip.comment || '',
                  pageLabel,
                  tooltip.ann.id,
                );
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

      {/* 2. Zotero 8-Color Palette Picker */}
      <div className="flex items-center justify-between gap-1 pb-2 border-b border-border-subtle">
        <span className="text-10 font-medium text-muted-foreground">Color:</span>
        <div className="flex items-center gap-1">
          {ZOTERO_COLORS.map((c) => {
            const isSelected =
              (tooltip.color || '#ffd400').toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Change to ${c.label}`}
                title={c.label}
                onClick={() => handleCardColorChange(c.hex)}
                className={cn(
                  'size-3.5 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2.5 md:before:hidden',
                  isSelected && 'ring-2 ring-primary ring-offset-1 scale-110',
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Quote Block (if exists) */}
      {tooltip.quote && (
        <p
          className="text-11 leading-snug text-foreground italic border-l-2 pl-2 my-2 select-text line-clamp-4"
          style={{ borderColor: tooltip.color }}
        >
          &ldquo;{tooltip.quote}&rdquo;
        </p>
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

      {/* 5. Tags (if available) */}
      {tooltip.ann.tags && tooltip.ann.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-border-subtle">
          {tooltip.ann.tags.map((t, tIdx) => (
            <span
              key={tIdx}
              className="text-10 font-mono px-1 py-0.2 rounded bg-muted text-foreground border border-border-subtle"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

