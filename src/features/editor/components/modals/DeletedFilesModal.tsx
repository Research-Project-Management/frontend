'use client';

import React, { useState, useMemo } from 'react';
import {
  Trash2,
  X,
  RotateCcw,
  Loader2,
  Search,
  FileCode2,
  BookText,
  Braces,
  FileType,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Badge,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { deletedFilesQuery, usePageActions } from '@/features/editor/hooks/use-core';
import type { PageFile } from '@/features/editor/types';

export interface DeletedFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
}

function getFileIcon(filename: string) {
  const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'tex':
    case 'ltx':
    case 'dtx':
      return { icon: FileCode2, color: 'text-primary' };
    case 'bib':
    case 'bst':
      return { icon: BookText, color: 'text-emerald-500 dark:text-emerald-400' };
    case 'cls':
    case 'sty':
    case 'ins':
      return { icon: Braces, color: 'text-sky-500 dark:text-sky-400' };
    case 'md':
    case 'txt':
      return { icon: FileType, color: 'text-muted-foreground' };
    default:
      return { icon: FileCode2, color: 'text-muted-foreground' };
  }
}

function formatDeletedTime(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Recently';
  }
}

export default function DeletedFilesModal({
  open,
  onOpenChange,
  pageId,
}: DeletedFilesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: deletedFiles = [], isLoading } = useQuery({
    ...deletedFilesQuery(pageId),
    enabled: open && Boolean(pageId),
  });

  const { restorePage } = usePageActions();

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return deletedFiles;
    const q = searchQuery.toLowerCase().trim();
    return deletedFiles.filter((f: PageFile) =>
      f.title?.toLowerCase().includes(q),
    );
  }, [deletedFiles, searchQuery]);

  const handleRestore = async (fileId: string) => {
    setRestoringId(fileId);
    try {
      await restorePage.mutateAsync(fileId);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Trash2 className="size-4 text-rose-500" />
              Deleted Files
              {deletedFiles.length > 0 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {deletedFiles.length}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Review and restore files previously deleted from this project
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search Bar */}
        {deletedFiles.length > 0 && (
          <div className="px-6 py-3 border-b border-border/60 bg-muted/10">
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deleted files..."
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-xs">Loading deleted files…</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Trash2 className="size-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? 'No matching deleted files' : 'No deleted files'}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                {searchQuery
                  ? `No deleted files matching "${searchQuery}"`
                  : 'Files you delete from this project will appear here and can be restored anytime.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/80 rounded-lg overflow-hidden">
              {filteredFiles.map((file: PageFile) => {
                const { icon: FileIcon, color: iconColor } = getFileIcon(file.title);
                const isRestoring = restoringId === file.id;

                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <div className="p-1.5 rounded-md bg-muted/60 shrink-0">
                        <FileIcon className={cn('size-4 shrink-0', iconColor)} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate font-mono">
                          {file.title}
                        </div>
                        <div className="flex items-center gap-1 text-11 text-muted-foreground mt-0.5">
                          <Clock className="size-3" />
                          <span>Deleted {formatDeletedTime((file as any).deletedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRestoring}
                      onClick={() => handleRestore(file.id)}
                      className="h-7 text-xs gap-1.5 shrink-0 cursor-pointer hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {isRestoring ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      <span>Restore</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span>
            {deletedFiles.length} file{deletedFiles.length === 1 ? '' : 's'} in trash
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
