'use client';

/**
 * ProjectTitleDropdown.tsx
 *
 * Project Title and Inline Rename Modal Trigger (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/ProjectTitleDropdown.tsx`
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { useProject } from '@/features/projects/shell/hooks/use-project';

import {
  projectRenameSchema,
  type ProjectRenameInput,
} from './project-title.schema';
import { useProjectTitleActions } from './useProjectTitleActions';

export function ProjectTitleDropdown() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);

  const effectiveProjectId =
    params?.projectId ||
    (typeof (currentPage as any)?.projectId === 'string'
      ? (currentPage as any).projectId
      : (currentPage as any)?.projectId?.id) ||
    storeProjectId ||
    '';

  const { project } = useProject(effectiveProjectId, {
    enabled: Boolean(effectiveProjectId),
  });

  const displayTitle =
    project?.name ||
    (currentPage as any)?.project?.name ||
    currentPage?.title ||
    'Untitled Project';

  const { getContent } = useEditorInstance();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { isSubmittingAction, handleApplyRename } = useProjectTitleActions({
    effectiveProjectId,
    displayTitle,
    currentPage: currentPage as any,
    activeFilePage,
    getContent,
    fallbackRootId: params?.pageId,
  });

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

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsRenameOpen(true)}
            className="group flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold text-foreground/90 hover:bg-sidebar-hover hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none max-w-[180px] sm:max-w-[280px] md:max-w-[380px] lg:max-w-[480px]"
            title={displayTitle}
            aria-label={`Rename project: ${displayTitle}`}
          >
            <span className="truncate">{displayTitle}</span>
            <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Click to rename project
        </TooltipContent>
      </Tooltip>

      {/* ── Rename Project Modal (Flat Precision / Impeccable standard) ── */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-lg text-foreground flex flex-col select-none"
        >
          {/* Header (Only Title and Close Icon, no divider line) */}
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
