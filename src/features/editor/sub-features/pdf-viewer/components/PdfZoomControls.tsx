'use client';

/**
 * PdfZoomControls.tsx
 *
 * Zoom level controls for PDF viewer:
 * - Zoom In / Out buttons
 * - Zoom preset dropdown (50% to 300%)
 * - Auto-fit width / page toggle
 */

import React from 'react';
import { Plus, Minus, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';

export interface PdfZoomControlsProps {
  scale: number;
  autoFit: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetScale?: (scale: number) => void;
}

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

export const PdfZoomControls = React.memo(function PdfZoomControls({
  scale,
  autoFit,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onSetScale,
}: PdfZoomControlsProps) {
  const percentage = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-0.5 select-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Minus className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Zoom out
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-6 px-1.5 flex items-center gap-1 rounded-sm text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span>{autoFit ? 'Fit Width' : `${percentage}%`}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-32 text-xs">
          <DropdownMenuItem
            onClick={onToggleAutoFit}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>Fit Width</span>
            {autoFit && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => {
                if (autoFit) onToggleAutoFit();
                onSetScale?.(preset);
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>{Math.round(preset * 100)}%</span>
              {!autoFit && scale === preset && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Zoom in
        </TooltipContent>
      </Tooltip>
    </div>
  );
});
