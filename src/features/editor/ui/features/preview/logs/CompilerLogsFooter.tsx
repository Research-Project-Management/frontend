'use client';

import React, { useState } from 'react';
import { Trash2, ChevronUp, FileText } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export interface CompilerLogsFooterProps {
  onClearCacheAndCompile?: () => void;
  outputFiles: string[];
  onDownloadFile: (fileName: string) => void;
  onDownloadAll: () => void;
  onDownloadRawLog?: () => void;
}

export function CompilerLogsFooter({
  onClearCacheAndCompile,
  outputFiles,
  onDownloadFile,
  onDownloadAll,
  onDownloadRawLog,
}: CompilerLogsFooterProps) {
  const [isOtherFilesOpen, setIsOtherFilesOpen] = useState(false);

  return (
    <footer className="h-10 px-3 border-t border-border bg-surface flex items-center justify-between shrink-0 select-none font-sans">
      {/* Left: Clear cached files & raw log download buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearCacheAndCompile}
          className="h-7 px-2.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-destructive"
          title="Clear auxiliary and cached compilation files"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Clear cached files</span>
        </button>

        {onDownloadRawLog && (
          <button
            type="button"
            onClick={onDownloadRawLog}
            aria-label="Download raw log"
            className="h-7 px-2.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary border border-border/60"
            title="Download full raw compile output.log"
          >
            <FileText className="size-3.5 shrink-0" />
            <span>Download raw log</span>
          </button>
        )}
      </div>

      {/* Right: Other logs and files Popover */}
      <Popover open={isOtherFilesOpen} onOpenChange={setIsOtherFilesOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 px-2.5 rounded-md bg-canvas hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary border border-border shadow-xs"
          >
            <span>Other logs and files</span>
            <ChevronUp
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
                isOtherFilesOpen && 'rotate-180'
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-56 p-2.5 bg-popover border border-border text-popover-foreground shadow-raised-300 rounded-md select-none outline-none font-sans"
        >
          {/* Header Title (1:1 Overleaf) */}
          <div className="px-2 py-1 text-xs font-normal text-foreground select-none">
            Download other output files
          </div>

          {/* Files List: Clean text-only rows, no divider lines, left aligned */}
          <div className="my-1.5 max-h-64 overflow-y-auto space-y-0.5">
            {outputFiles.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => onDownloadFile(file)}
                className="w-full text-left px-2 py-1 text-xs text-foreground/90 hover:text-foreground hover:bg-muted rounded-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary truncate"
                title={`Download ${file}`}
              >
                {file}
              </button>
            ))}
          </div>

          {/* Bottom Action: Download all (count), no divider line */}
          <button
            type="button"
            onClick={onDownloadAll}
            className="w-full text-left px-2 py-1 text-xs font-normal text-foreground hover:bg-muted rounded-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            Download all ({outputFiles.length})
          </button>
        </PopoverContent>
      </Popover>
    </footer>
  );
}
