'use client';

import React, { useMemo } from 'react';
import {
  FileText,
  RotateCcw,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ProjectDiffResponse } from '@/features/editor/domain/types/history.types';
import { SideBySideDiffViewer } from './SideBySideDiffViewer';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';

export interface DiffContentPaneProps {
  diffData: ProjectDiffResponse | null | undefined;
  isLoadingDiff: boolean;
  activeFilePath: string | null;
  viewMode: 'split' | 'unified';
  selectedBaseVersion: number | null;
  selectedTargetVersion: number | null;
  onRestoreSingleFile: () => void;
  isRestoringSingleFile?: boolean;
  confirmingFileRestore: boolean;
  setConfirmingFileRestore: (confirming: boolean) => void;
}

export function DiffContentPane({
  diffData,
  isLoadingDiff,
  activeFilePath,
  viewMode,
  selectedBaseVersion,
  selectedTargetVersion,
  onRestoreSingleFile,
  isRestoringSingleFile = false,
  confirmingFileRestore,
  setConfirmingFileRestore,
}: DiffContentPaneProps) {
  const activeFileDiff = useMemo(() => {
    if (!diffData?.files || diffData.files.length === 0) return null;
    if (activeFilePath) {
      const match = diffData.files.find((f) => f.path === activeFilePath);
      if (match) return match;
    }
    return diffData.files[0] || null;
  }, [diffData, activeFilePath]);

  if (isLoadingDiff) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span>
          Computing differences between v{selectedBaseVersion} and v{selectedTargetVersion}...
        </span>
      </main>
    );
  }

  if (!diffData || diffData.files.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-6 text-center bg-background">
        <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
          <Check className="size-6 text-success" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No differences detected</h3>
        <p className="text-muted-foreground text-xs mt-1 max-w-sm">
          The files in Version {selectedTargetVersion} are identical to Version {selectedBaseVersion}.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Active File Diff Action Bar */}
        {activeFileDiff && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border text-xs shrink-0 select-none overflow-x-auto overflow-y-hidden scrollbar-none gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <FileText className={cn("size-3.5", activeFileDiff.status === 'deleted' ? "text-destructive" : "text-muted-foreground")} strokeWidth={1.5} />
              <span className={cn(
                "font-mono font-semibold text-xs",
                activeFileDiff.status === 'deleted' ? "text-destructive line-through" : "text-foreground"
              )}>
                {activeFileDiff.path}
              </span>
              <Badge variant="outline" className="text-10 font-mono h-4 px-1.5 gap-1">
                <span className="text-success">+{activeFileDiff.additions}</span>
                <span className="text-destructive">-{activeFileDiff.deletions}</span>
              </Badge>
              {activeFileDiff.status === 'deleted' && (
                <Badge variant="destructive" className="text-10 font-mono px-1.5 h-4">
                  Deleted
                </Badge>
              )}
              {activeFileDiff.status === 'added' && (
                <Badge variant="default" className="text-10 font-mono px-1.5 h-4 bg-success/20 text-success border-success/30">
                  New File
                </Badge>
              )}
            </div>

            {selectedBaseVersion && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant={confirmingFileRestore || activeFileDiff.status === 'deleted' ? 'destructive' : 'secondary'}
                  size="sm"
                  className="h-7 min-h-[28px] px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
                  disabled={isRestoringSingleFile}
                  onClick={() => {
                    if (confirmingFileRestore) {
                      onRestoreSingleFile();
                    } else {
                      setConfirmingFileRestore(true);
                    }
                  }}
                >
                  {isRestoringSingleFile ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  <span>
                    {confirmingFileRestore
                      ? `Confirm restore ${activeFileDiff.path.split('/').pop() || 'file'} to v${selectedBaseVersion}`
                      : activeFileDiff.status === 'deleted'
                      ? `Restore deleted file (v${selectedBaseVersion})`
                      : `Restore v${selectedBaseVersion}`}
                  </span>
                </Button>

                {confirmingFileRestore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingFileRestore(false)}
                    className="h-7 min-h-[28px] px-2 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deleted File Informational Banner */}
        {activeFileDiff && activeFileDiff.status === 'deleted' && selectedBaseVersion && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/10 border-b border-destructive/20 text-xs text-foreground shrink-0">
            <span className="font-semibold text-destructive text-10 px-1.5 py-0.5 rounded bg-destructive/20 shrink-0">
              Deleted File
            </span>
            <span className="truncate">
              <span className="font-mono font-semibold">{activeFileDiff.path}</span> was deleted in Version {selectedTargetVersion}.
            </span>
          </div>
        )}

        {/* Diff Viewer Area */}
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          {viewMode === 'split' ? (
            activeFileDiff ? (
              <SideBySideDiffViewer
                fileDiff={activeFileDiff}
                baseVersion={selectedBaseVersion || 1}
                targetVersion={selectedTargetVersion || 2}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Select a file from the left tree to view changes.
              </div>
            )
          ) : activeFileDiff ? (
            <UnifiedDiffViewer
              fileDiff={activeFileDiff}
              baseVersion={selectedBaseVersion || 1}
              targetVersion={selectedTargetVersion || 2}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              Select a file from the left tree to view changes.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
