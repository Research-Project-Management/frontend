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
  label = 'Resize pane',
  valueNow,
  valueMin,
  valueMax,
  className,
  children,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative w-1 h-full cursor-col-resize shrink-0 outline-none select-none bg-transparent hover:bg-primary/30 transition-colors z-20',
        isDragging && 'bg-primary/50',
        className,
      )}
    >
      {/* Invisible expanded hit target for touch and easy cursor grabbing */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
      {children}
    </div>
  );
}

export default ResizeHandle;
