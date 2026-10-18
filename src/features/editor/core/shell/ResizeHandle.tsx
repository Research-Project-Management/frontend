/**
 * ResizeHandle.tsx
 *
 * Project-Themed Overleaf-Parity Separator & Draggable Splitter Handle.
 * Location: `features/editor/ui/shell/ResizeHandle.tsx`
 *
 * Design Specifications:
 * - 8px gutter bar matching the project's light & dark design tokens.
 * - Flush rectangular collapse segment with rounded-none fitting 100% within the 8px groove.
 * - Zero overflow into adjacent editor or sidebar panes.
 * - High-contrast chevron centered in the rectangular block.
 * - 4 square grip dots centered cleanly in the lower groove section.
 */

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onDoubleClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
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
}

export function ResizeHandle({
  onMouseDown,
  onTouchStart,
  onDoubleClick,
  onKeyDown,
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
}: ResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal' || className?.includes('cursor-row-resize');

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleCollapse?.();
  };

  const isPointingLeft =
    (collapseDirection === 'left' && !isCollapsed) ||
    (collapseDirection === 'right' && isCollapsed);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative shrink-0 outline-none select-none z-20 flex overflow-hidden transition-all duration-150 touch-none',
        isHorizontal
          ? 'h-[6px] w-full cursor-row-resize flex-row items-center justify-center bg-sidebar border-y border-border'
          : 'w-[8px] h-full cursor-col-resize flex-col items-center bg-sidebar border-x border-border',
        isDragging && 'bg-muted border-border',
        className,
      )}
    >
      {/* ── Overleaf Flush Collapse Button: w-full, rounded-none, strictly inside groove ── */}
      {showCollapseButton && (
        <button
          type="button"
          onClick={handleToggleClick}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          className={cn(
            'absolute z-30 flex items-center justify-center cursor-pointer outline-none p-0 transition-all duration-150',
            'w-full h-14 rounded-none after:absolute after:-inset-x-3 after:-inset-y-1 after:content-[\'\']',
            'bg-muted-foreground/20 text-muted-foreground',
            'hover:bg-muted-foreground/35 hover:text-foreground active:scale-95',
            'top-[38%] -translate-y-1/2 left-0 right-0',
          )}
        >
          {isPointingLeft ? (
            <ChevronLeft className="w-[6px] h-[10px] shrink-0 text-current" strokeWidth={2.75} />
          ) : (
            <ChevronRight className="w-[6px] h-[10px] shrink-0 text-current" strokeWidth={2.75} />
          )}
        </button>
      )}

      {/* ── 4 Square Grip Dots: strictly inside groove, rounded-none ── */}
      {showGripDots && !isHorizontal && (
        <div className="absolute top-[65%] -translate-y-1/2 left-0 right-0 flex flex-col items-center gap-[3px] pointer-events-none select-none">
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40" />
        </div>
      )}

      {children}
    </div>
  );
}

export default ResizeHandle;
