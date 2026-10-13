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
import { useParams, useRouter } from 'next/navigation';
import {
  Pencil,
  Copy,
  Download,
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
import { toast } from 'sonner';

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

import { usePageStore } from '@/features/editor/store/editor.store';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { useProject } from '@/features/projects/shell/hooks/use-project';
import { useProjectExport } from '@/features/editor/ui/hooks/useExport';
import { duplicateProjectApi } from '@/features/projects/shell/services/project.service';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

import { projectRenameSchema, type ProjectRenameInput } from '@/features/editor/domain/types/forms.types';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { useProjectTitleActions } from './useProjectTitleActions';

export function ProjectTitleDropdown() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const router = useRouter();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);

  const effectiveProjectId =
    params?.projectId ||
    extractProjectId(currentPage) ||
    storeProjectId ||
    '';

  const { project } = useProject(effectiveProjectId, {
    enabled: Boolean(effectiveProjectId),
  });

  const displayTitle =
    project?.name ||
    currentPage?.title ||
    'Untitled Project';

  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { isSubmittingAction, handleApplyRename } = useProjectTitleActions({
    effectiveProjectId,
    displayTitle,
    currentPage,
    activeFilePage,
    getContent,
    fallbackRootId: params?.pageId,
  });

  const {
    downloadPdf,
    downloadCopy,
    exportZip,
  } = useProjectExport();

  const renameForm = useForm<ProjectRenameInput>({
    resolver: zodResolver(projectRenameSchema),
    defaultValues: { name: displayTitle },
  });

  useEffect(() => {
    if (isRenameOpen) {
      renameForm.reset({ name: displayTitle });
      setTimeout(() => renameInputRef.current?.select(), 50);
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

  const handleMakeCopy = async () => {
    if (effectiveProjectId) {
      const toastId = toast.loading('Duplicating project...');
      setIsCopying(true);
      try {
        const res = (await duplicateProjectApi(effectiveProjectId)) as {
          project?: { id?: string };
          id?: string;
        } | null;
        const newProjId = res?.project?.id || res?.id;
        toast.success('Project duplicated successfully!', { id: toastId });
        if (newProjId) {
          router.push(`/projects/${newProjId}/pages`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to duplicate project.';
        toast.error(message, { id: toastId });
        downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
      } finally {
        setIsCopying(false);
      }
    } else {
      downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
    }
  };

  const handleDownloadZip = () => {
    const rootId = params?.pageId || params?.projectId || currentPage?.id;
    if (!rootId) return;
    exportZip({
      parentPageId: rootId,
      projectTitle: currentPage?.title,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadPdf = () => {
    downloadPdf(pdfUrl, currentPage?.title);
  };

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
            className="group flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-semibold text-foreground/90 hover:bg-sidebar-hover hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none max-w-[180px] sm:max-w-[260px] md:max-w-[320px]"
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
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {displayTitle}
          </div>

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
            onClick={handleDownloadZip}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <FileArchive className="size-3.5 text-muted-foreground shrink-0" />
            <span>Download Source (.zip)</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDownloadPdf}
            disabled={!pdfUrl}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-muted"
          >
            <FileText className="size-3.5 text-muted-foreground shrink-0" />
            <span>Download PDF</span>
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
          className="sm:max-w-md w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-md text-foreground flex flex-col select-none"
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
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
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
