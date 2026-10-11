'use client';

import React, { useState } from 'react';
import { Trash2, ChevronUp, Download } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';

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
    <footer className="h-10 px-3 border-t border-border/60 flex items-center justify-between shrink-0 select-none font-sans">
      <div className="flex items-center gap-1.5">
        {/* Left: Clear cached files button */}
        <button
          type="button"
          onClick={onClearCacheAndCompile}
          className="h-7 px-2.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-destructive"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Clear cached files</span>
        </button>

        {/* Download raw log (Overleaf Parity) */}
        {onDownloadRawLog && (
          <button
            type="button"
            onClick={onDownloadRawLog}
            aria-label="Download raw log"
            className="h-7 px-2.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <Download className="size-3.5 shrink-0" />
            <span>Download raw log</span>
          </button>
        )}
      </div>

      {/* Right: Other logs and files Popover */}
      <Popover open={isOtherFilesOpen} onOpenChange={setIsOtherFilesOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 px-2.5 rounded-md hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary border border-border/60"
          >
            <span>Other logs and files</span>
            <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-64 p-0 bg-popover border border-border text-popover-foreground shadow-raised-300 rounded-md overflow-hidden select-none"
        >
          <div className="px-3.5 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/40">
            Download other output files
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {outputFiles.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => onDownloadFile(file)}
                className="w-full text-left px-3.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-between group outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
              >
                <span>{file}</span>
                <Download className="size-3 text-muted-foreground group-hover:text-foreground" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onDownloadAll}
            className="w-full px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted border-t border-border bg-muted/20 transition-colors cursor-pointer flex items-center justify-between outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span>Download all ({outputFiles.length})</span>
            <Download className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverContent>
      </Popover>
    </footer>
  );
}
