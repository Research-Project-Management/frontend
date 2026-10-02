'use client';

/**
 * ResizeHandle.tsx
 *
 * Accessible, draggable column separator with expanded invisible hit area
 * for smooth 3-pane resizing in the Editor Cockpit.
 */

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
        'group relative w-full h-full cursor-col-resize shrink-0 outline-none select-none bg-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}

