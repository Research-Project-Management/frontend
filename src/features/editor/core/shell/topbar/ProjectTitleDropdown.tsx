'use client';

/**
 * ProjectTitleDropdown.tsx
 *
 * Canonical Overleaf Project Title & Actions Dropdown (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/ProjectTitleDropdown.tsx`
 *
 * Features (1:1 Overleaf Parity):
 * - Project title display with subtle dropdown indicator.
 * - Dropdown menu containing: Rename, Make a copy, Download Source (.zip),
 *   Download PDF, Template Gallery, and Project Settings.
 * - Flat Precision Inline Rename Dialog.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Pencil,
  Copy,
  FileArchive,
  FileText,
  Settings,
  LayoutTemplate,
  ChevronDown,
  Loader2,
  X,
  Calculator,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

import { usePageStore } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { useProject } from '@/features/projects/shell/hooks/use-project';
import { editorCommandBus } from '@/features/editor/core';

import { projectRenameSchema, type ProjectRenameInput } from '@/features/editor/domain/types/forms.types';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { useProjectTitleActions } from './useProjectTitleActions';

export function ProjectTitleDropdown() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id ?? undefined);
  const currentPageTitle = usePageStore((s) => s.currentPage?.title ?? undefined);
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage) ?? undefined);
  const activeFileId = usePageStore((s) => s.activeFilePage?.id ?? undefined);
  const activeFileTitle = usePageStore((s) => s.activeFilePage?.title ?? undefined);
  const storeProjectId = usePageStore((s) => s.projectId);

  const effectiveProjectId =
    params?.projectId ||
    currentPageProjectId ||
    storeProjectId ||
    '';

  const { project } = useProject(effectiveProjectId, {
    enabled: Boolean(effectiveProjectId),
  });

  const displayTitle =
    project?.name ||
    currentPageTitle ||
    'Untitled Project';

  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const {
    isSubmittingAction,
    isCopying,
    handleApplyRename,
    handleMakeCopy,
    handleDownloadZip,
    handleDownloadPdf,
  } = useProjectTitleActions({
    effectiveProjectId,
    displayTitle,
    currentPage: currentPageId ? ({ id: currentPageId, title: currentPageTitle || '' } as never) : null,
    activeFilePage: activeFileId ? ({ id: activeFileId, title: activeFileTitle || '' } as never) : null,
    getContent,
    pdfUrl,
    fallbackRootId: params?.pageId,
  });

  const renameForm = useForm<ProjectRenameInput>({
    resolver: zodResolver(projectRenameSchema),
    defaultValues: { name: displayTitle },
  });

  useEffect(() => {
    if (isRenameOpen) {
      renameForm.reset({ name: displayTitle });
      const timer = setTimeout(() => renameInputRef.current?.select(), 50);
      return () => clearTimeout(timer);
    }
  }, [isRenameOpen, displayTitle, renameForm]);

  const onRenameSubmit = renameForm.handleSubmit(async (data) => {
    if (data.name.trim() === displayTitle) {
      setIsRenameOpen(false);
      return;
    }
    const success = await handleApplyRename(data.name);
    if (success) {
      setIsRenameOpen(false);
    }
  });

  const handleOpenSettings = () => {
    useSettingsStore.getState().setSettingsPanelOpen(true);
  };

  const handleOpenTemplateGallery = () => {
    useSettingsStore.getState().setIsTemplateModalOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'template-gallery' });
  };

  const handleOpenWordCount = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  };

  const handleOpenDeletedFiles = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'deleted-files' });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-semibold text-foreground/90 hover:bg-sidebar-hover hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border select-none max-w-[180px] sm:max-w-[260px] md:max-w-[320px]"
            title={displayTitle}
            aria-label={`Project: ${displayTitle}`}
          >
            <span className="truncate">{displayTitle}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-56 p-1 bg-popover text-popover-foreground border border-border shadow-md rounded-md text-xs z-50 select-none"
        >
          <div className="px-2.5 py-1.5 text-12 font-medium text-muted-foreground select-none truncate">
            {displayTitle}
          </div>

          <DropdownMenuItem
            onClick={handleDownloadPdf}
            disabled={!pdfUrl}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <FileText className="size-3.5 text-muted-foreground shrink-0" />
            <span>Download PDF</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDownloadZip}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <FileArchive className="size-3.5 text-muted-foreground shrink-0" />
            <span>Download Source (.zip)</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleOpenWordCount}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <Calculator className="size-3.5 text-muted-foreground shrink-0" />
            <span>Word count</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleOpenDeletedFiles}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <Trash2 className="size-3.5 text-muted-foreground shrink-0" />
            <span>Deleted files</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setIsRenameOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <Pencil className="size-3.5 text-muted-foreground shrink-0" />
            <span>Rename project</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMakeCopy}
            disabled={isCopying}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <Copy className="size-3.5 text-muted-foreground shrink-0" />
            <span>{isCopying ? 'Duplicating...' : 'Make a copy'}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleOpenTemplateGallery}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <LayoutTemplate className="size-3.5 text-muted-foreground shrink-0" />
            <span>Template gallery</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleOpenSettings}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <Settings className="size-3.5 text-muted-foreground shrink-0" />
            <span>Project Settings</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Rename Project Modal ── */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] sm:w-full sm:max-w-md p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-md text-foreground flex flex-col select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 bg-background shrink-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Rename Project
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsRenameOpen(false)}
              aria-label="Close"
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <DialogDescription className="sr-only">
            Change the name of this project
          </DialogDescription>

          <form onSubmit={onRenameSubmit}>
            <div className="px-5 pt-3 pb-2 space-y-1.5">
              <label htmlFor="project-rename-input" className="text-12 font-medium text-foreground">
                Project name
              </label>
              {(() => {
                const { ref, ...rest } = renameForm.register('name');
                return (
                  <Input
                    id="project-rename-input"
                    ref={(el) => {
                      ref(el);
                      (renameInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                    }}
                    {...rest}
                    disabled={isSubmittingAction}
                    className="w-full text-12 h-8 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                    placeholder="Enter project name"
                    autoFocus
                  />
                );
              })()}
              {renameForm.formState.errors.name && (
                <p className="text-11 text-destructive">{renameForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="px-5 pb-5 pt-3 bg-background flex items-center justify-end gap-2 shrink-0 border-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRenameOpen(false)}
                disabled={isSubmittingAction}
                className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
              >
                Close
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingAction}
                className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
              >
                {isSubmittingAction && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />}
                <span>Rename</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProjectTitleDropdown;
