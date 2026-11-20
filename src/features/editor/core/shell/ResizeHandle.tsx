/**
 * ResizeHandle.tsx
 *
 * Interactive IDE Separator & Draggable Splitter Handle.
 * Location: `features/editor/core/shell/ResizeHandle.tsx`
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ResizeHandleProps {
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onDoubleClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  orientation?: 'vertical' | 'horizontal';
  label?: string;
  valueNow?: number;
  valueMin?: number;
  valueMax?: number;
  className?: string;
  children?: React.ReactNode;

  // Overleaf Separator Features
  showCollapseButton?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseDirection?: 'left' | 'right';
  showGripDots?: boolean;

  // Optional declarative horizontal drag callback (receives current clientX and startClientX)
  onDragX?: (clientX: number, startClientX: number) => void;
}

export interface HorizontalDragOptions {
  thresholdPx?: number;
  onStart?: () => void;
  onEnd?: (didDrag: boolean) => void;
  cursor?: string;
}

export function startHorizontalDrag(
  startClientX: number,
  onMove: (clientX: number, startClientX: number) => void,
  options?: HorizontalDragOptions,
): () => void {
  const thresholdPx = options?.thresholdPx ?? 0;
  const lockCursor = options?.cursor ?? 'col-resize';

  let rafId: number | null = null;
  let rafScheduled = false;
  let didDrag = false;
  let hasPendingMove = false;
  let latestClientX = startClientX;
  let cleanedUp = false;
  let prevCursor = '';
  let prevUserSelect = '';
  let hasLockedBody = false;

  const activateDrag = () => {
    if (didDrag) return;
    didDrag = true;
    if (typeof document !== 'undefined') {
      prevCursor = document.body.style.cursor;
      prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = lockCursor;
      document.body.style.userSelect = 'none';
      hasLockedBody = true;
    }
    options?.onStart?.();
  };

  const handleMove = (clientX: number) => {
    if (cleanedUp) return;
    if (!didDrag) {
      if (Math.abs(clientX - startClientX) < thresholdPx) {
        return;
      }
      activateDrag();
    }
    latestClientX = clientX;
    hasPendingMove = true;
    if (rafScheduled) return;
    rafScheduled = true;
    rafId = requestAnimationFrame(() => {
      rafScheduled = false;
      rafId = null;
      if (cleanedUp || !hasPendingMove) return;
      hasPendingMove = false;
      onMove(latestClientX, startClientX);
    });
  };

  const onMouseMove = (moveEvent: MouseEvent) => {
    handleMove(moveEvent.clientX);
  };

  const onTouchMove = (moveEvent: TouchEvent) => {
    if (moveEvent.touches.length === 0) return;
    handleMove(moveEvent.touches[0].clientX);
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (rafScheduled && rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafScheduled = false;
    rafId = null;
    if (didDrag && hasPendingMove) {
      hasPendingMove = false;
      onMove(latestClientX, startClientX);
    }
    if (hasLockedBody && typeof document !== 'undefined') {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      hasLockedBody = false;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', cleanup);
      window.removeEventListener('touchcancel', cleanup);
      window.removeEventListener('blur', cleanup);
    }
    options?.onEnd?.(didDrag);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', cleanup);
    window.addEventListener('touchcancel', cleanup);
    window.addEventListener('blur', cleanup);
  }

  return cleanup;
}

export function ResizeHandle({
  onMouseDown,
  onTouchStart,
  onDoubleClick,
  onKeyDown,
  onDragStart,
  onDragEnd,
  isDragging = false,
  orientation = 'vertical',
  label = 'Resize pane',
  valueNow,
  valueMin,
  valueMax,
  className,
  children,
  showCollapseButton = false,
  isCollapsed = false,
  onToggleCollapse,
  collapseDirection = 'left',
  showGripDots = true,
  onDragX,
}: ResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal' || className?.includes('cursor-row-resize');
  const [isInternalDragging, setIsInternalDragging] = useState(false);
  const activeDragCleanupRef = useRef<(() => void) | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);

  const activeDragging = isDragging || isInternalDragging;

  useEffect(() => {
    return () => {
      activeDragCleanupRef.current?.();
      activeDragCleanupRef.current = null;
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = null;
      }
    };
  }, []);

  const beginDrag = useCallback(
    (startX: number, thresholdPx: number, suppressClickOnDrag: boolean) => {
      if (!onDragX) return;
      activeDragCleanupRef.current?.();
      const cancel = startHorizontalDrag(startX, onDragX, {
        thresholdPx,
        cursor: isHorizontal ? 'row-resize' : 'col-resize',
        onStart: () => {
          setIsInternalDragging(true);
          onDragStart?.();
        },
        onEnd: (didDrag) => {
          activeDragCleanupRef.current = null;
          setIsInternalDragging(false);
          if (didDrag) {
            onDragEnd?.();
            if (suppressClickOnDrag) {
              suppressNextClickRef.current = true;
              if (suppressTimerRef.current !== null) {
                window.clearTimeout(suppressTimerRef.current);
              }
              suppressTimerRef.current = window.setTimeout(() => {
                suppressNextClickRef.current = false;
                suppressTimerRef.current = null;
              }, 0);
            }
          }
        },
      });
      activeDragCleanupRef.current = cancel;
    },
    [isHorizontal, onDragEnd, onDragStart, onDragX],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (onDragX) {
      e.preventDefault();
      beginDrag(e.clientX, 0, false);
    }
    onMouseDown?.(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (onDragX && e.touches.length > 0) {
      beginDrag(e.touches[0].clientX, 0, false);
    }
    onTouchStart?.(e);
  };

  const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (isCollapsed && !onDragX) {
      onToggleCollapse?.();
    }
  };

  const handleRailDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onDoubleClick?.();
  };

  const handleRailKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onKeyDown?.(e);
  };

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (!isCollapsed && onDragX) {
      e.preventDefault();
      beginDrag(e.clientX, 4, true);
    }
  };

  const handleButtonTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isCollapsed && onDragX && e.touches.length > 0) {
      beginDrag(e.touches[0].clientX, 4, true);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onToggleCollapse?.();
  };

  const isPointingLeft =
    (collapseDirection === 'left' && !isCollapsed) ||
    (collapseDirection === 'right' && isCollapsed);

  const toggleTitle = isCollapsed ? 'Expand panel' : 'Collapse panel';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleRailClick}
      onDoubleClick={handleRailDoubleClick}
      onKeyDown={handleRailKeyDown}
      className={cn(
        'group relative shrink-0 outline-none select-none z-20 flex items-center justify-center overflow-hidden transition-colors duration-150 touch-none',
        isHorizontal
          ? cn(
              'h-[8px] w-full flex-row bg-muted/50 border-y border-border/80 hover:bg-primary/10 hover:border-primary/40 focus-visible:bg-primary/10 focus-visible:border-primary/50 cursor-row-resize',
              activeDragging && 'bg-primary/15 border-primary',
            )
          : cn(
              'w-[10px] h-full flex-col bg-muted/50 border-x border-border/80 hover:bg-primary/10 hover:border-primary/40 focus-visible:bg-primary/10 focus-visible:border-primary/50',
              activeDragging && 'bg-primary/15 border-primary',
              isCollapsed && !onDragX ? 'cursor-pointer' : 'cursor-col-resize',
            ),
        className,
      )}
    >
      {/* ── Active / Hover Center Guide Line ──────────────────────────────── */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block transition-colors duration-150',
          isHorizontal
            ? cn(
                'w-full h-px bg-transparent group-hover:bg-primary/50 group-focus-visible:bg-primary/50',
                activeDragging && 'h-[2px] bg-primary',
              )
            : cn(
                'h-full w-px bg-transparent group-hover:bg-primary/50 group-focus-visible:bg-primary/50',
                activeDragging && 'w-[2px] bg-primary',
              ),
        )}
      />

      {/* ── Flush Collapse / Expand Segment strictly inside 10px groove ─── */}
      {showCollapseButton && (
        <button
          type="button"
          onClick={handleToggleClick}
          onMouseDown={handleButtonMouseDown}
          onTouchStart={handleButtonTouchStart}
          aria-label={toggleTitle}
          title={toggleTitle}
          className={cn(
            'absolute top-[42%] -translate-y-1/2 left-0 right-0 z-30 flex items-center justify-center',
            'w-full h-11 rounded-none p-0',
            'bg-background/90 border-y border-border text-muted-foreground',
            'hover:bg-primary/15 hover:text-primary hover:border-primary/40',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            'transition-colors duration-150 cursor-pointer',
            activeDragging && 'bg-primary/15 text-primary border-primary',
          )}
        >
          {isPointingLeft ? (
            <ChevronLeft className="w-2.5 h-3.5 shrink-0 text-current" strokeWidth={2.5} />
          ) : (
            <ChevronRight className="w-2.5 h-3.5 shrink-0 text-current" strokeWidth={2.5} />
          )}
        </button>
      )}

      {/* ── 3 Clean Vertical Grip Dots strictly inside 10px groove ────────── */}
      {showGripDots && !isHorizontal && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute top-[58%] -translate-y-1/2 left-0 right-0 flex flex-col items-center gap-[3px]"
        >
          <span className="size-[3px] rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 transition-colors" />
          <span className="size-[3px] rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 transition-colors" />
          <span className="size-[3px] rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 transition-colors" />
        </div>
      )}

      {/* ── Full-Viewport Drag Shield (above CodeMirror .cm-gutters z-200) ── */}
      {activeDragging && (
        <div
          aria-hidden="true"
          className={cn(
            'fixed inset-0 z-[9999] select-none',
            isHorizontal ? 'cursor-row-resize' : 'cursor-col-resize',
          )}
        />
      )}

      {children}
    </div>
  );
}

export default ResizeHandle;
