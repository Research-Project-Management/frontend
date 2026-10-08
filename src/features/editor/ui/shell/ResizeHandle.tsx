/**
 * ResizeHandle.tsx
 *
 * Accessible, draggable column separator with expanded invisible hit area
 * for smooth pane resizing in the Workbench Shell (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/ResizeHandle.tsx`
 */

'use client';

import React from 'react';
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
  hideGrip?: boolean;
  className?: string;
  children?: React.ReactNode;
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
}: ResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal' || className?.includes('cursor-row-resize');

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
        'group relative shrink-0 outline-none select-none z-20',
        isHorizontal
          ? 'h-0 w-full cursor-row-resize'
          : 'w-0 h-full cursor-col-resize',
        className,
      )}
    >
      {/* Visual active line / highlight centered exactly on the 1px border seam */}
      <div
        className={cn(
          'absolute transition-colors pointer-events-none',
          isHorizontal
            ? 'inset-x-0 -top-[1px] h-[2px] bg-transparent group-hover:bg-primary/40'
            : 'inset-y-0 -left-[1px] w-[2px] bg-transparent group-hover:bg-primary/40',
          isDragging && 'bg-primary/60',
        )}
      />

      {/* Invisible expanded hit target for touch and easy cursor grabbing */}
      <span
        className={cn(
          'absolute z-10',
          isHorizontal
            ? 'inset-x-0 -top-2 -bottom-2 cursor-row-resize'
            : 'inset-y-0 -left-2 -right-2 cursor-col-resize',
        )}
      />
      {children}
    </div>
  );
}

export default ResizeHandle;
