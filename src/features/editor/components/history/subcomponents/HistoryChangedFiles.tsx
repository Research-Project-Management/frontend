'use client';

import React from 'react';
import { FileText, FileX } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ChangedFileItem {
  cleanPath: string;
  status?: string;
  additions?: number;
  deletions?: number;
  id: string;
}

export interface ProjectFileItem {
  id: string;
  title?: string;
  name?: string;
  path?: string;
}

export interface SnapshotFileItem {
  path: string;
  id: string;
  type?: string;
  isRootDoc?: boolean;
}

interface HistoryChangedFilesProps {
  isOpen: boolean;
  viewMode: 'diff' | 'snapshot';
  diffChangedFiles: ChangedFileItem[];
  unchangedFiles: ProjectFileItem[];
  snapshotFiles: SnapshotFileItem[];
  deletedFiles: ProjectFileItem[];
  selectedFilePath: string | null;
  onSelectFile: (filePath: string) => void;
  activeVersionNumber: number;
}

export function HistoryChangedFiles({
  isOpen,
  viewMode,
  diffChangedFiles,
  unchangedFiles,
  snapshotFiles,
  deletedFiles,
  selectedFilePath,
  onSelectFile,
  activeVersionNumber,
}: HistoryChangedFilesProps) {
  if (!isOpen) return null;

  const cleanSelected = selectedFilePath?.replace(/^\//, '') || null;

  return (
    <aside
      aria-label="Changed files pane"
      className="w-56 shrink-0 border-r border-border bg-background flex flex-col min-h-0 select-none animate-in fade-in duration-150 motion-reduce:animate-none"
    >
      {/* Pane Section Header */}
      <div className="h-9 px-3 border-b border-border text-11 font-heading font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between shrink-0">
        <span>
          {viewMode === 'diff'
            ? `Changed files: ${diffChangedFiles.length}`
            : `Snapshot files: ${snapshotFiles.length}`}
        </span>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
        {viewMode === 'diff' ? (
          diffChangedFiles.length === 0 ? (
            <div className="px-3 py-6 text-center text-11 text-muted-foreground font-mono">
              No files changed in this comparison
            </div>
          ) : (
            <>
              {/* Diff Changed Files */}
              {diffChangedFiles.map((file) => {
                const isSelected = cleanSelected === file.cleanPath;
                return (
                  <button
                    key={file.cleanPath}
                    type="button"
                    aria-selected={isSelected}
                    aria-label={`Select file ${file.cleanPath}`}
                    onClick={() => onSelectFile(file.cleanPath)}
                    className={cn(
                      'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors text-left outline-none border focus-visible:ring-1 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold border-primary'
                        : 'bg-transparent border-transparent text-foreground/90 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 font-mono text-12">
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{file.cleanPath}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1.5 font-mono text-11">
                      {file.status === 'added' ? (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded-md leading-tight font-medium',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                          )}
                        >
                          +{file.additions || 1}
                        </span>
                      ) : file.status === 'deleted' ? (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded-md leading-tight font-medium',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-destructive/15 text-destructive',
                          )}
                        >
                          -{file.deletions || 1}
                        </span>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          {(file.additions ?? 0) > 0 && (
                            <span
                              className={cn(
                                'px-1 py-0.5 rounded-md leading-tight font-medium',
                                isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                              )}
                            >
                              +{file.additions}
                            </span>
                          )}
                          {(file.deletions ?? 0) > 0 && (
                            <span
                              className={cn(
                                'px-1 py-0.5 rounded-md leading-tight font-medium',
                                isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-destructive/15 text-destructive',
                              )}
                            >
                              -{file.deletions}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Unchanged Files Section */}
              {unchangedFiles.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border">
                  <div className="px-2 py-1 text-11 font-semibold text-muted-foreground uppercase tracking-wide">
                    Unchanged files: {unchangedFiles.length}
                  </div>
                  <div className="space-y-1 mt-1">
                    {unchangedFiles.map((file) => {
                      const fileName = file.title || file.name || file.path || 'untitled';
                      const isSelected = cleanSelected === fileName.replace(/^\//, '');
                      return (
                        <button
                          key={file.id}
                          type="button"
                          aria-selected={isSelected}
                          aria-label={`Select file ${fileName}`}
                          onClick={() => onSelectFile(fileName)}
                          className={cn(
                            'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors text-left outline-none border focus-visible:ring-1 focus-visible:ring-primary',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold border-primary'
                              : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0 font-mono text-12">
                            <FileText className="size-3.5 shrink-0" />
                            <span className="truncate">{fileName}</span>
                          </div>
                          <span className="text-11 font-mono text-muted-foreground">Same</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          /* Snapshot Files List */
          snapshotFiles.map((file) => {
            const isSelected = cleanSelected === file.path.replace(/^\//, '');
            return (
              <button
                key={file.path}
                type="button"
                aria-selected={isSelected}
                aria-label={`Select snapshot file ${file.path}`}
                onClick={() => onSelectFile(file.path)}
                className={cn(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors text-left outline-none border focus-visible:ring-1 focus-visible:ring-primary',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold border-primary'
                    : 'bg-transparent border-transparent text-foreground/90 hover:bg-muted hover:text-foreground',
                )}
              >
                <div className="flex items-center gap-2 truncate min-w-0 font-mono text-12">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </div>
                <span
                  className={cn(
                    'text-11 font-mono font-medium px-1.5 py-0.5 rounded-md leading-tight shrink-0',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  v{activeVersionNumber}
                </span>
              </button>
            );
          })
        )}

        {/* Deleted Files Section */}
        {deletedFiles.length > 0 && (
          <div className="pt-2 mt-2 border-t border-border">
            <div className="px-2 py-1 flex items-center justify-between text-11 font-semibold text-destructive uppercase tracking-wide">
              <span>Deleted files: {deletedFiles.length}</span>
            </div>
            <div className="space-y-1 mt-1">
              {deletedFiles.map((file) => {
                const fileName = file.title || file.name || file.path || 'deleted_file';
                const isSelected = cleanSelected === fileName.replace(/^\//, '');
                return (
                  <button
                    key={file.id}
                    type="button"
                    aria-selected={isSelected}
                    aria-label={`Select deleted file ${fileName}`}
                    onClick={() => onSelectFile(fileName)}
                    className={cn(
                      'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors text-left outline-none border focus-visible:ring-1 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-destructive/15 text-destructive border-destructive/30 font-semibold'
                        : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted hover:text-foreground line-through decoration-destructive/50',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 font-mono text-12">
                      <FileX className="size-3.5 shrink-0 text-destructive" />
                      <span className="truncate">{fileName}</span>
                    </div>
                    <span className="text-11 font-mono font-medium px-1.5 py-0.5 rounded-md leading-tight bg-destructive/15 text-destructive shrink-0">
                      Deleted
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default HistoryChangedFiles;
