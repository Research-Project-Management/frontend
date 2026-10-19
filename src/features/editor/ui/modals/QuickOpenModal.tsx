'use client';

/**
 * QuickOpenModal.tsx
 *
 * Canonical Fast Fuzzy File Switcher Modal Ctrl+P (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/QuickOpenModal.tsx`
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/shared/components/ui/command';
import { cn } from '@/shared/lib/utils';
import { usePageStore } from '@/features/editor/core';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import type { PageFile } from '@/features/editor/domain/types/core.types';
import { getFileIcon } from './DeletedFilesModal';

interface QuickOpenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickOpenModal({ open, onOpenChange }: QuickOpenModalProps) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const activeFileId = usePageStore((s) => s.activeFilePage?.id);
  const rootId = currentPageId || params?.pageId;

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootId || ''),
    enabled: Boolean(rootId) && open,
  });

  const handleSelectFile = (file: PageFile) => {
    if (!file) return;
    navigationCoordinator.openDocument({
      fileId: file.id,
      title: file.title || 'untitled.tex',
      path: file.path,
    });
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Open File"
      description="Quickly switch between project files by searching"
      showCloseButton={false}
      className="w-[95vw] sm:max-w-lg"
    >
      <CommandInput placeholder="Type a file name to jump to..." />
      <CommandList className="max-h-80 p-1">
        <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
          No matching files found.
        </CommandEmpty>
        <CommandGroup heading="Project Files">
          {pageFiles.map((file: PageFile) => {
            const { icon: IconComp, color } = getFileIcon(file.title || '');
            const isActive = file.id === activeFileId;

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
