'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  FileCode2,
  BookText,
  Braces,
  Image as ImageIcon,
  Search,
  X,
  FilePlus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { usePageStore, useTabsStore } from '@/features/editor/store';
import { filesQuery } from '@/features/editor/hooks/use-core';

interface QuickOpenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'tex':
    case 'ltx':
      return { icon: FileCode2, color: 'text-primary' };
    case 'bib':
      return { icon: BookText, color: 'text-emerald-500' };
    case 'cls':
    case 'sty':
      return { icon: Braces, color: 'text-amber-500' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'pdf':
      return { icon: ImageIcon, color: 'text-blue-500' };
    default:
      return { icon: FileText, color: 'text-muted-foreground' };
  }
}

export default function QuickOpenModal({ open, onOpenChange }: QuickOpenModalProps) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const { currentPage, setActiveFilePage, activeFilePage } = usePageStore();
  const { openTab } = useTabsStore();
  const rootId = currentPage?.id || params?.pageId;

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootId ?? ''),
    enabled: Boolean(rootId),
  });

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pageFiles;
    return pageFiles.filter((f: any) =>
      (f.title || '').toLowerCase().includes(q)
    );
  }, [pageFiles, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const effectiveProjectId =
    (currentPage?.projectId as any)?.id ||
    (typeof currentPage?.projectId === 'string' ? currentPage.projectId : null) ||
    params?.projectId ||
    rootId ||
    '';

  const handleSelectFile = (file: any) => {
    if (!file) return;
    setActiveFilePage(file);
    if (effectiveProjectId) {
      openTab(effectiveProjectId, {
        id: file.id,
        title: file.title || 'untitled.tex',
        fileUrl: file.url,
      });
    }
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelectFile(filtered[selectedIndex]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl text-foreground select-none">
        <DialogTitle className="sr-only">Quick Open File</DialogTitle>
        <DialogDescription className="sr-only">
          Quickly switch between project files by searching
        </DialogDescription>

        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-muted/20 gap-2.5">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a file name to jump to... (↑ ↓ to navigate)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-muted-foreground shrink-0">
            Esc to close
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching files found.
            </div>
          ) : (
            filtered.map((file: any, index: number) => {
              const { icon: IconComp, color } = getFileIcon(file.title || '');
              const isSelected = index === selectedIndex;
              const isActive = file.id === activeFilePage?.id;

              return (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-sidebar-hover text-foreground'
                      : 'text-foreground/80 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComp className={cn('size-4 shrink-0', color)} />
                    <span className={cn('font-medium truncate', isActive && 'text-emerald-600 dark:text-emerald-400 font-semibold')}>
                      {file.title || 'untitled.tex'}
                    </span>
                  </div>

                  {isActive && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Active
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
