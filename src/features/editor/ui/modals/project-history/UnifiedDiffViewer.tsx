'use client';

/**
 * UnifiedDiffViewer.tsx
 *
 * Unified single-column diff hunk viewer with line numbers and word-level token highlight.
 * Location: `features/editor/ui/modals/project-history/UnifiedDiffViewer.tsx`
 */

import React from 'react';
import { Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type {
  ProjectFileDiff,
  DiffHunk,
  DiffLine,
} from '../../../domain/types/history.types';

export interface UnifiedDiffViewerProps {
  fileDiff: ProjectFileDiff;
  baseVersion?: number;
  targetVersion?: number;
}

export const UnifiedDiffViewer = React.memo(function UnifiedDiffViewer({
  fileDiff,
  baseVersion = 1,
  targetVersion = 2,
}: UnifiedDiffViewerProps) {
  if (!fileDiff.hunks || fileDiff.hunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        <AlertCircle className="size-6 mb-2 opacity-50" />
        <p>No content differences for this file.</p>
      </div>
    );
  }

  const handleCopyHunk = (hunk: DiffHunk) => {
    const text = (hunk.lines || [])
      .map((l) => (l.type === 'added' ? `+ ${l.text}` : l.type === 'deleted' ? `- ${l.text}` : `  ${l.text}`))
      .join('\n');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success('Hunk diff copied to clipboard');
  };

  const handleCopyBaseHunk = (hunk: DiffHunk) => {
    const text = (hunk.lines || [])
      .filter((l) => l.type !== 'added')
      .map((l) => l.text)
      .join('\n');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success(`Base v${baseVersion} snippet copied to clipboard`);
  };

  const handleCopyTargetHunk = (hunk: DiffHunk) => {
    const text = (hunk.lines || [])
      .filter((l) => l.type !== 'deleted')
      .map((l) => l.text)
      .join('\n');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success(`Target v${targetVersion} snippet copied to clipboard`);
  };

  return (
    <div className="h-full w-full overflow-y-auto border rounded-md bg-background font-mono text-xs select-text">
      {fileDiff.hunks.map((hunk: DiffHunk, hIdx: number) => (
        <div key={hIdx} className="border-b last:border-b-0">
          {/* Hunk Header with Copy Controls */}
          <div className="bg-muted/70 px-3 py-1 text-muted-foreground font-semibold text-[11px] flex items-center justify-between select-none border-y first:border-t-0">
            <div className="flex items-center gap-2">
              <span>
                @@ -{hunk.oldStartLine},{hunk.oldLineCount} +{hunk.newStartLine},{hunk.newLineCount} @@
              </span>
              {hunk.header && <span className="text-foreground/70 truncate max-w-xs">{hunk.header}</span>}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-1 hover:bg-background/80 cursor-pointer"
                onClick={() => handleCopyHunk(hunk)}
                title="Copy hunk diff"
              >
                <Copy className="size-2.5" />
                <span>Hunk</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-1 hover:bg-background/80 cursor-pointer"
                onClick={() => handleCopyBaseHunk(hunk)}
                title={`Copy base v${baseVersion} snippet`}
              >
                <Copy className="size-2.5" />
                <span>Base v{baseVersion}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-1 hover:bg-background/80 cursor-pointer"
                onClick={() => handleCopyTargetHunk(hunk)}
                title={`Copy target v${targetVersion} snippet`}
              >
                <Copy className="size-2.5" />
                <span>Target v{targetVersion}</span>
              </Button>
            </div>
          </div>

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
                    isAdded && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-l-2 border-emerald-500',
                    isDeleted && 'bg-rose-500/10 text-rose-900 dark:text-rose-200 border-l-2 border-rose-500 line-through opacity-85',
                    !isAdded && !isDeleted && 'text-muted-foreground hover:bg-muted/30'
                  )}
                >
                  {/* Line Numbers */}
                  <div className="flex select-none text-[10px] text-muted-foreground/60 w-16 shrink-0 justify-between pr-3 font-mono">
                    <span className="w-7 text-right">{line.oldLineNumber || ''}</span>
                    <span className="w-7 text-right">{line.newLineNumber || ''}</span>
                  </div>

                  {/* Prefix Sign */}
                  <span className="w-4 select-none shrink-0 font-bold">
                    {isAdded ? '+' : isDeleted ? '-' : ' '}
                  </span>

                  {/* Line Content with Word Tokens if available */}
                  <div className="flex-1 whitespace-pre-wrap break-all font-mono">
                    {line.words && line.words.length > 0 ? (
                      line.words.map((w, wIdx) => (
                        <span
                          key={wIdx}
                          className={cn(
                            w.type === 'added' && 'bg-emerald-500/30 text-emerald-950 dark:text-emerald-100 font-semibold px-0.5 rounded',
                            w.type === 'deleted' && 'bg-rose-500/30 text-rose-950 dark:text-rose-100 line-through px-0.5 rounded',
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
