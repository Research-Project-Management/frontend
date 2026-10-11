/**
 * ResizeHandle.tsx
 *
 * Project-Themed Overleaf-Parity Separator & Draggable Splitter Handle.
 * Location: `features/editor/ui/shell/ResizeHandle.tsx`
 *
 * Design Specifications:
 * - 8px gutter bar matching the project's light & dark design tokens.
 * - Flush rectangular collapse segment with rounded-none (bo góc none) fitting 100% within the 8px groove.
 * - Zero overflow into adjacent editor or sidebar panes (không tràn ra ngoài).
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
        'group relative shrink-0 outline-none select-none z-20 flex overflow-hidden',
        isHorizontal
          ? 'h-[6px] w-full cursor-row-resize flex-row items-center justify-center bg-[#ededed] hover:bg-[#e4e4e4] border-y border-[#dedede] dark:bg-[#202023] dark:hover:bg-[#28282c] dark:border-[#2d2d31] transition-colors'
          : 'w-[8px] h-full cursor-col-resize flex-col items-center bg-[#ededed] hover:bg-[#e4e4e4] border-x border-[#dedede] dark:bg-[#202023] dark:hover:bg-[#28282c] dark:border-[#2d2d31] transition-colors',
        isDragging && 'bg-primary/20 border-primary/40',
        className,
      )}
    >
      {/* ── Overleaf Flush Collapse Button: w-full, rounded-none, strictly inside groove ── */}
      {showCollapseButton && (
        <button
          type="button"
          onClick={handleToggleClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          className={cn(
            'absolute z-30 flex items-center justify-center cursor-pointer transition-colors outline-none p-0',
            'w-full h-14 rounded-none',
            'bg-[#d5d7db] hover:bg-[#c6c9cf] active:bg-[#b8bcc5] text-foreground',
            'dark:bg-[#343842] dark:hover:bg-[#404552] dark:active:bg-[#2c3038]',
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
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40 group-hover:bg-muted-foreground/80 transition-colors" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40 group-hover:bg-muted-foreground/80 transition-colors" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40 group-hover:bg-muted-foreground/80 transition-colors" />
          <span className="w-[2px] h-[2px] rounded-none bg-muted-foreground/40 group-hover:bg-muted-foreground/80 transition-colors" />
        </div>
      )}

      {children}
    </div>
  );
}

export default ResizeHandle;
