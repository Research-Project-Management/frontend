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
      aria-valuemax={400}
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
          setWidth(Math.min(400, width + 10));
        }
      }}
      className="hidden md:flex absolute top-0 -right-1.5 w-3 h-full cursor-col-resize items-center justify-center z-30 select-none group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <div
        className={cn(
          "w-0.5 h-full transition-colors duration-150",
          "group-hover:bg-primary/60",
          isDragging && "bg-primary"
        )}
      />
    </div>
  );
}
