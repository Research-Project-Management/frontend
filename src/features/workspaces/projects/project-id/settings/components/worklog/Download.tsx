'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

interface DownloadProps {
  onDownloadCsv: () => void;
  onDownloadExcel: () => void;
  disabled?: boolean;
}

export function WorklogDownload({
  onDownloadCsv,
  onDownloadExcel,
  disabled,
}: DownloadProps) {
  return (
    <DropdownMenu>
      <div className="inline-flex rounded-md shadow-none overflow-hidden">
        {/* Main button */}
        <button
          type="button"
          onClick={onDownloadCsv}
          disabled={disabled}
          className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span>Download</span>
        </button>

        {/* Chevron split trigger */}
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="h-8 px-2 bg-primary hover:bg-primary/90 text-primary-foreground border-l border-primary-foreground/20 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Download format options"
          >
            <ChevronDown className="size-3.5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent align="end" className="w-36 p-1 rounded-md">
        <DropdownMenuItem
          onClick={onDownloadExcel}
          className="px-3 py-2 text-xs font-normal text-foreground rounded-md cursor-pointer hover:bg-muted focus:bg-muted transition-colors"
        >
          <span>Excel</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDownloadCsv}
          className="px-3 py-2 text-xs font-normal text-foreground rounded-md cursor-pointer hover:bg-muted focus:bg-muted transition-colors"
        >
          <span>CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
