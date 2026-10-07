'use client';

/**
 * PdfZoomControls.tsx
 *
 * Zoom level controls for PDF viewer (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfZoomControls.tsx`
 */

import React from 'react';
import { Plus, Minus, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

export interface PdfZoomControlsProps {
  scale: number;
  autoFit: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetScale?: (scale: number) => void;
  compact?: boolean;
}

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

export const PdfZoomControls = React.memo(function PdfZoomControls({
  scale,
  autoFit,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onSetScale,
  compact = false,
}: PdfZoomControlsProps) {
  const percentage = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-0.5 select-none">
      {!compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onZoomOut}
              aria-label="Zoom out"
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Minus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Zoom out</TooltipContent>
        </Tooltip>
      )}

      {/* Preset Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Select zoom level"
            className="h-7 px-2 flex items-center gap-1 rounded-md text-xs font-mono font-medium text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span>{autoFit ? 'Fit' : `${percentage}%`}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          sideOffset={4}
          className="w-32 p-1 text-xs bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 select-none"
        >
          <DropdownMenuItem
            onClick={onToggleAutoFit}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>Fit Width</span>
            {autoFit && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-t border-border" />

          {ZOOM_PRESETS.map((preset) => {
            const isSelected = !autoFit && Math.abs(scale - preset) < 0.05;
            return (
              <DropdownMenuItem
                key={preset}
                onClick={() => onSetScale?.(preset)}
                className="flex items-center justify-between px-2 py-1 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>{Math.round(preset * 100)}%</span>
                {isSelected && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {!compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onZoomIn}
              aria-label="Zoom in"
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Zoom in</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
