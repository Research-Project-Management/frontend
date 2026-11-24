'use client';

/**
 * UnifiedDiffView.tsx
 *
 * Unified single-column diff hunk viewer with line numbers and word-level token highlight.
 * Location: `features/editor/subsystems/history/ui/UnifiedDiffView.tsx`
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  ProjectFileDiff,
  DiffHunk,
  DiffLine,
} from '@/features/editor/domain/types/history.types';

function formatHunkRange(hunk: DiffHunk): string {
  if (hunk.newLineCount > 0) {
    const start = hunk.newStartLine;
    const end = start + hunk.newLineCount - 1;
    return end > start ? `Lines ${start}–${end}` : `Line ${start}`;
  }
  const start = hunk.oldStartLine;
  const end = hunk.oldLineCount > 0 ? start + hunk.oldLineCount - 1 : start;
  return end > start ? `Lines ${start}–${end}` : `Line ${start}`;
}

export interface DiffHunkHeaderProps {
  hunk: DiffHunk;
  baseVersion?: number;
  targetVersion?: number;
  className?: string;
}

export const DiffHunkHeader = React.memo(function DiffHunkHeader({
  hunk,
  className,
}: DiffHunkHeaderProps) {
  return (
    <div
      className={cn(
        'bg-muted/70 px-3 py-1 text-muted-foreground font-medium text-[11px] flex items-center justify-between select-none border-y first:border-t-0',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span>{formatHunkRange(hunk)}</span>
        {hunk.header && <span className="text-foreground/70 truncate max-w-xs">{hunk.header}</span>}
      </div>
    </div>
  );
});

export interface UnifiedDiffViewProps {
  fileDiff: ProjectFileDiff;
  baseVersion?: number;
  targetVersion?: number;
}

export const UnifiedDiffView = React.memo(function UnifiedDiffView({
  fileDiff,
}: UnifiedDiffViewProps) {
  if (!fileDiff.hunks || fileDiff.hunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        <AlertCircle className="size-6 mb-2 opacity-50" />
        <p>No content differences for this file.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto border rounded-md bg-background font-mono text-xs select-text">
      {fileDiff.hunks.map((hunk: DiffHunk, hIdx: number) => (
        <div key={hIdx} className="border-b last:border-b-0">
          {/* Hunk Header */}
          <DiffHunkHeader hunk={hunk} />

          {/* Hunk Lines */}
          <div className="divide-y divide-border/20">
            {hunk.lines.map((line: DiffLine, lIdx: number) => {
              const isAdded = line.type === 'added';
              const isDeleted = line.type === 'deleted';

              return (
                <div
                  key={lIdx}
                  className={cn(
                    'flex items-start px-2 py-0.5 leading-5 font-mono transition-colors',
                    isAdded && 'bg-success/10 text-success border-l border-success',
                    isDeleted && 'bg-destructive/10 text-destructive border-l border-destructive line-through opacity-85',
                    !isAdded && !isDeleted && 'text-muted-foreground hover:bg-muted/30'
                  )}
                >
                  {/* Line Numbers */}
                  <div className="flex select-none text-[10px] text-muted-foreground/60 w-16 shrink-0 justify-between pr-3 font-mono">
                    <span className="w-7 text-right">{line.oldLineNumber || ''}</span>
                    <span className="w-7 text-right">{line.newLineNumber || ''}</span>
                  </div>

                  {/* Prefix Sign */}
                  <span className="w-4 select-none shrink-0 font-semibold">
                    {isAdded ? '+' : isDeleted ? '-' : ' '}
                  </span>

                  {/* Line Content with Word Tokens if available */}
                  <div className="flex-1 whitespace-pre-wrap break-all font-mono">
                    {line.words && line.words.length > 0 ? (
                      line.words.map((w, wIdx) => (
                        <span
                          key={wIdx}
                          className={cn(
                            w.type === 'added' && 'bg-success/20 text-success font-semibold px-0.5 rounded-sm',
                            w.type === 'deleted' && 'bg-destructive/20 text-destructive line-through px-0.5 rounded-sm',
                          )}
                        >
                          {w.text}
                        </span>
                      ))
                    ) : (
                      line.text || ' '
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
