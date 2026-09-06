'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { pageNavFormSchema } from '../../schemas/reader.schema';
import type { PageNavFormData } from '../../types/reader.types';

interface PdfViewerToolbarProps {
  pageNumber: number;
  numPages: number | null;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  loading: boolean;
}

export default function PdfViewerToolbar({
  pageNumber,
  numPages,
  zoom,
  onPageChange,
  onZoomChange,
  onFitWidth,
  loading,
}: PdfViewerToolbarProps) {
  const { register, handleSubmit, reset } = useForm<PageNavFormData>({
    resolver: zodResolver(pageNavFormSchema),
    defaultValues: {
      page: pageNumber,
    },
  });

  useEffect(() => {
    reset({ page: pageNumber });
  }, [pageNumber, reset]);

  const onPageSubmit = (data: PageNavFormData) => {
    if (numPages && data.page >= 1 && data.page <= numPages) {
      onPageChange(data.page);
    } else {
      reset({ page: pageNumber });
    }
  };

  const handleZoomOut = () => {
    const nextZoom = Number(Math.max(0.5, zoom - 0.1).toFixed(2));
    onZoomChange(nextZoom);
  };

  const handleZoomIn = () => {
    const nextZoom = Number(Math.min(3.0, zoom + 0.1).toFixed(2));
    onZoomChange(nextZoom);
  };

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex w-full select-none items-center justify-between text-xs text-foreground">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                disabled={pageNumber <= 1 || loading}
                onClick={() => onPageChange(pageNumber - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Previous page</TooltipContent>
          </Tooltip>

          <form onSubmit={handleSubmit(onPageSubmit)} className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={numPages ?? undefined}
              {...register('page', { valueAsNumber: true })}
              onBlur={handleSubmit(onPageSubmit)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  reset({ page: pageNumber });
                  e.currentTarget.blur();
                }
              }}
              disabled={loading || !numPages}
              aria-label="Current page"
              className="h-6 w-11 px-1 text-center font-mono text-xs tabular-nums text-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-sm border-border/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground select-none">
              / {numPages ?? '-'}
            </span>
          </form>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                disabled={numPages ? pageNumber >= numPages || loading : true}
                onClick={() => onPageChange(pageNumber + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Next page</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom and fit controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                disabled={zoom <= 0.5 || loading}
                onClick={handleZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Zoom out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onZoomChange(1.0)}
                disabled={loading}
                aria-label="Reset zoom to 100%"
                className="min-w-[2.75rem] px-1.5 py-1 text-center font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
              >
                {Math.round(zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Reset zoom to 100%</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                disabled={zoom >= 3.0 || loading}
                onClick={handleZoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Zoom in</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-3.5 w-px bg-border/60" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                onClick={onFitWidth}
                disabled={loading}
                aria-label="Fit to width"
              >
                <Maximize2 className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Fit to width</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
