'use client';

import React, { useMemo } from 'react';
import {
  FileText,
  Copy,
  RotateCcw,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ProjectDiffResponse } from '../../../domain/types/history.types';
import { SideBySideDiffViewer } from './SideBySideDiffViewer';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';

export interface DiffContentPaneProps {
  diffData: ProjectDiffResponse | null | undefined;
  isLoadingDiff: boolean;
  activeFilePath: string | null;
  setActiveFilePath: (path: string) => void;
  viewMode: 'split' | 'unified';
  selectedBaseVersion: number | null;
  selectedTargetVersion: number | null;
  onCopyBaseFile: () => void;
  onRestoreSingleFile: () => void;
  isRestoringSingleFile?: boolean;
  confirmingFileRestore: boolean;
  setConfirmingFileRestore: (confirming: boolean) => void;
}

export function DiffContentPane({
  diffData,
  isLoadingDiff,
  activeFilePath,
  setActiveFilePath,
  viewMode,
  selectedBaseVersion,
  selectedTargetVersion,
  onCopyBaseFile,
  onRestoreSingleFile,
  isRestoringSingleFile = false,
  confirmingFileRestore,
  setConfirmingFileRestore,
}: DiffContentPaneProps) {
  const activeFileDiff = useMemo(() => {
    if (!diffData?.files || !activeFilePath) return null;
    return diffData.files.find((f) => f.path === activeFilePath) || diffData.files[0] || null;
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
          <Check className="size-6 text-emerald-500" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No differences detected</h3>
        <p className="text-muted-foreground text-xs mt-1 max-w-sm">
          The files in Version {selectedTargetVersion} are identical to Version {selectedBaseVersion}.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Changed Files Tab Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b overflow-x-auto shrink-0 select-none">
          <span className="text-xs font-semibold text-muted-foreground mr-1.5 uppercase tracking-wider text-[10px]">
            Files:
          </span>
          {diffData.files.map((file) => {
            const isActive = file.path === activeFilePath;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setActiveFilePath(file.path)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors shrink-0 cursor-pointer',
                  isActive
                    ? 'bg-background text-foreground border shadow-xs font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <FileText className="size-3 shrink-0" />
                <span>{file.path}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                  +{file.additions}
                </span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-sans">
                  -{file.deletions}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active File Diff Action Bar */}
        {activeFileDiff && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b text-xs shrink-0 select-none">
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="font-mono font-semibold text-foreground text-xs">{activeFileDiff.path}</span>
              <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 gap-1">
                <span className="text-emerald-600 dark:text-emerald-400">+{activeFileDiff.additions}</span>
                <span className="text-rose-600 dark:text-rose-400">-{activeFileDiff.deletions}</span>
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Copy Base File */}
              {selectedBaseVersion && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 cursor-pointer"
                  onClick={onCopyBaseFile}
                  title={`Copy entire content of ${activeFileDiff.path} from Version ${selectedBaseVersion}`}
                >
                  <Copy className="size-3" />
                  <span className="hidden sm:inline">Copy v{selectedBaseVersion} File</span>
                </Button>
              )}

              {/* 1-Click Partial Restore for this file */}
              {selectedBaseVersion && (
                <div className="flex items-center gap-1">
                  <Button
                    variant={confirmingFileRestore ? 'destructive' : 'secondary'}
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
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
                        : 'Restore this file'}
                    </span>
                  </Button>

                  {confirmingFileRestore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingFileRestore(false)}
                      className="h-7 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
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
                Select a file above to view changes.
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
              Select a file above to view changes.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
