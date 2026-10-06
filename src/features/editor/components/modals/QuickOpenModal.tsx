'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  FileCode2,
  BookText,
  Braces,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/shared/components/ui/command';
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
    ...filesQuery(rootId || ''),
    enabled: Boolean(rootId) && open,
  });

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Open File"
      description="Quickly switch between project files by searching"
      className="max-w-lg"
    >
      <CommandInput placeholder="Type a file name to jump to..." />
      <CommandList className="max-h-80 p-1">
        <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
          No matching files found.
        </CommandEmpty>
        <CommandGroup heading="Project Files">
          {pageFiles.map((file: any) => {
            const { icon: IconComp, color } = getFileIcon(file.title || '');
            const isActive = file.id === activeFilePage?.id;

            return (
              <CommandItem
                key={file.id}
                value={file.title || ''}
                onSelect={() => handleSelectFile(file)}
                className="flex items-center justify-between px-3 py-2 text-xs rounded-md cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconComp className={cn('size-4 shrink-0', color)} />
                  <span className={cn('truncate font-medium', isActive && 'text-primary font-semibold')}>
                    {file.title || 'untitled.tex'}
                  </span>
                </div>

                {isActive && (
                  <span className="text-10 font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary shrink-0">
                    Active
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
