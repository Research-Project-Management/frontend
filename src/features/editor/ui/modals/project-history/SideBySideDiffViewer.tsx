'use client';

/**
 * SideBySideDiffViewer.tsx
 *
 * Synchronized split column diff viewer rendering base and target revisions side-by-side.
 * Location: `features/editor/ui/modals/project-history/SideBySideDiffViewer.tsx`
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

export interface AlignedSplitRow {
  oldLine: DiffLine | null;
  newLine: DiffLine | null;
  type: 'unchanged' | 'modified' | 'deleted' | 'added';
}

export function alignHunkForSplitView(hunk: DiffHunk): AlignedSplitRow[] {
  const rows: AlignedSplitRow[] = [];
  const lines = hunk.lines || [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'unchanged') {
      rows.push({
        oldLine: line,
        newLine: line,
        type: 'unchanged',
      });
      i++;
    } else {
      // Group consecutive deletions
      const deletions: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'deleted') {
        deletions.push(lines[i]);
        i++;
      }

      // Group consecutive additions
      const additions: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'added') {
        additions.push(lines[i]);
        i++;
      }

      // Pair up deletions and additions row-by-row
      const maxCount = Math.max(deletions.length, additions.length);
      for (let j = 0; j < maxCount; j++) {
        const del = deletions[j] || null;
        const add = additions[j] || null;
        let rowType: 'modified' | 'deleted' | 'added' = 'modified';
        if (del && !add) rowType = 'deleted';
        else if (!del && add) rowType = 'added';
        else rowType = 'modified';

        rows.push({
          oldLine: del,
          newLine: add,
          type: rowType,
        });
      }
    }
  }

  return rows;
}

export interface SideBySideDiffViewerProps {
  fileDiff: ProjectFileDiff;
  baseVersion?: number;
  targetVersion?: number;
}

export const SideBySideDiffViewer = React.memo(function SideBySideDiffViewer({
  fileDiff,
  baseVersion = 1,
  targetVersion = 2,
}: SideBySideDiffViewerProps) {
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
    <div className="h-full w-full flex flex-col border rounded-md bg-background font-mono text-xs select-text overflow-hidden">
      {/* Synchronized Columns Header */}
      <div className="grid grid-cols-2 bg-muted/70 border-b text-xs font-mono select-none divide-x divide-border shrink-0">
        <div className="flex items-center justify-between px-3 py-1.5 font-medium text-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500/70" />
            <span className="font-semibold">Base: v{baseVersion}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 font-medium text-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500/70" />
            <span className="font-semibold">Target: v{targetVersion}</span>
          </div>
        </div>
      </div>

      {/* Synchronized Scroll Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {fileDiff.hunks.map((hunk, hIdx) => {
          const rows = alignHunkForSplitView(hunk);

          return (
            <div key={hIdx} className="border-b last:border-b-0">
              {/* Hunk Header with Copy Controls */}
              <div className="bg-muted/50 px-3 py-1 text-muted-foreground font-semibold text-[11px] flex items-center justify-between select-none border-y first:border-t-0">
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

              {/* Synchronized Rows */}
              <div className="divide-y divide-border/20">
                {rows.map((row, rIdx) => {
                  const hasOld = !!row.oldLine;
                  const hasNew = !!row.newLine;
                  const isOldDeleted = row.oldLine?.type === 'deleted';
                  const isNewAdded = row.newLine?.type === 'added';

                  return (
                    <div
                      key={rIdx}
                      className="grid grid-cols-2 divide-x divide-border/30 font-mono text-xs leading-5 hover:bg-muted/20 transition-colors"
                    >
                      {/* Left Cell: Base */}
                      <div
                        className={cn(
                          'flex items-start px-2 py-0.5 min-h-[22px]',
                          isOldDeleted && 'bg-rose-500/10 text-rose-950 dark:text-rose-200 border-l-2 border-rose-500',
                          !hasOld && 'bg-muted/20 select-none'
                        )}
                      >
                        {hasOld ? (
                          <>
                            <span className="w-8 select-none text-[10px] text-muted-foreground/60 text-right pr-2 shrink-0">
                              {row.oldLine!.oldLineNumber || ''}
                            </span>
                            <span className="w-4 select-none shrink-0 font-bold text-rose-600 dark:text-rose-400">
                              {isOldDeleted ? '-' : ' '}
                            </span>
                            <div className="flex-1 whitespace-pre-wrap break-all">
                              {row.oldLine!.words && row.oldLine!.words.length > 0 ? (
                                row.oldLine!.words
                                  .filter((w) => w.type !== 'added')
                                  .map((w, wIdx) => (
                                    <span
                                      key={wIdx}
                                      className={cn(
                                        w.type === 'deleted' &&
                                          'bg-rose-500/30 text-rose-950 dark:text-rose-100 font-semibold px-0.5 rounded'
                                      )}
                                    >
                                      {w.text}
                                    </span>
                                  ))
                              ) : (
                                row.oldLine!.text || ' '
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 opacity-20 text-[10px] select-none">&nbsp;</div>
                        )}
                      </div>

                      {/* Right Cell: Target */}
                      <div
                        className={cn(
                          'flex items-start px-2 py-0.5 min-h-[22px]',
                          isNewAdded && 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-l-2 border-emerald-500',
                          !hasNew && 'bg-muted/20 select-none'
                        )}
                      >
                        {hasNew ? (
                          <>
                            <span className="w-8 select-none text-[10px] text-muted-foreground/60 text-right pr-2 shrink-0">
                              {row.newLine!.newLineNumber || ''}
                            </span>
                            <span className="w-4 select-none shrink-0 font-bold text-emerald-600 dark:text-emerald-400">
                              {isNewAdded ? '+' : ' '}
                            </span>
                            <div className="flex-1 whitespace-pre-wrap break-all">
                              {row.newLine!.words && row.newLine!.words.length > 0 ? (
                                row.newLine!.words
                                  .filter((w) => w.type !== 'deleted')
                                  .map((w, wIdx) => (
                                    <span
                                      key={wIdx}
                                      className={cn(
                                        w.type === 'added' &&
                                          'bg-emerald-500/30 text-emerald-950 dark:text-emerald-100 font-semibold px-0.5 rounded'
                                      )}
                                    >
                                      {w.text}
                                    </span>
                                  ))
                              ) : (
                                row.newLine!.text || ' '
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 opacity-20 text-[10px] select-none">&nbsp;</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
