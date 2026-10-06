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
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
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
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-lg text-foreground flex flex-col max-h-[85vh] select-none"
      >
        {/* ── Dialog Header (Only Title and Close Icon) ─────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-background shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Deleted Files
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-hidden transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Review and restore files previously deleted from this project
        </DialogDescription>

        {/* ── Search Bar ────────────────────────────────────────────────────── */}
        {deletedFiles.length > 0 && (
          <div className="px-5 pt-3 pb-1 shrink-0 bg-background">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deleted files..."
                className="pl-8 h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
              />
            </div>
          </div>
        )}

        {/* ── Body: Open Lines List ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-2 max-h-[50vh] thin-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
              <p className="text-12">Loading deleted files…</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <div className="size-9 rounded-full bg-muted/60 flex items-center justify-center mb-2.5">
                <Trash2 className="size-4 text-muted-foreground/60" strokeWidth={1.5} />
              </div>
              <p className="text-13 font-medium text-foreground">
                {searchQuery ? 'No matching deleted files' : 'No deleted files'}
              </p>
              <p className="text-11 text-muted-foreground max-w-xs mt-1">
                {searchQuery
                  ? `No deleted files matching "${searchQuery}"`
                  : 'Files you delete from this project will appear here and can be restored anytime.'}
              </p>
            </div>
          ) : (
            <div className="w-full divide-y divide-border/60">
              {filteredFiles.map((file: PageFile) => {
                const { icon: FileIcon, color: iconColor } = getFileIcon(file.title);
                const isRestoring = restoringId === file.id;

                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between py-2 px-1 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <div className="p-1.5 rounded-sm bg-muted/50 shrink-0">
                        <FileIcon className={cn('size-3.5 shrink-0', iconColor)} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-12 font-medium text-foreground truncate font-mono">
                          {file.title}
                        </div>
                        <div className="flex items-center gap-1 text-10 text-muted-foreground mt-0.5">
                          <Clock className="size-3" strokeWidth={1.5} />
                          <span>Deleted {formatDeletedTime((file as any).deletedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRestoring}
                      onClick={() => handleRestore(file.id)}
                      className="h-7 px-2.5 text-11 gap-1.5 shrink-0 cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                    >
                      {isRestoring ? (
                        <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <RotateCcw className="size-3" strokeWidth={1.5} />
                      )}
                      <span>Restore</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Dialog Footer (Only Close button) ─────────────────────────────── */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 m-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
