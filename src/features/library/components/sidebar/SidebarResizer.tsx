'use client';

import { cn } from "@/shared/lib/utils";

interface SidebarResizerProps {
  width: number;
  setWidth: (w: number) => void;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function SidebarResizer({
  width,
  setWidth,
  isDragging,
  onMouseDown,
}: SidebarResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={200}
      aria-valuemax={480}
      aria-label="Resize library sidebar (double-click to reset width)"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={() => setWidth(240)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setWidth(Math.max(200, width - 10));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setWidth(Math.min(480, width + 10));
        }
      }}
      className={cn(
        "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-30 select-none focus-visible:outline-none",
        isDragging && "bg-primary/50"
      )}
    />
  );
}
