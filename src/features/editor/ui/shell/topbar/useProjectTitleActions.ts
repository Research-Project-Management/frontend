'use client';

/**
 * useProjectTitleActions.ts
 *
 * Dedicated custom hook encapsulating topbar project actions and notifications:
 * - PDF download
 * - Source ZIP export
 * - Word document export
 * - Project renaming (with cache invalidation and toast feedback)
 * - Project duplication / Make a copy (with navigation and toast feedback)
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are managed inside hooks, keeping components purely presentation-focused.
 * Location: `features/editor/ui/shell/topbar/useProjectTitleActions.ts`
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePageActions } from '@/features/editor/hooks/use-core';
import { useProjectExport } from '@/features/editor/hooks/use-export';
import { useUpdateProject, useDuplicateProject } from '@/features/projects/shell/hooks/use-project';
import type { Page, PageFile } from '@/features/editor/types';

export interface UseProjectTitleActionsOptions {
  effectiveProjectId: string;
  displayTitle: string;
  currentPage?: any;
  activeFilePage?: any;
  getContent: () => string;
  pdfUrl?: string | null;
  fallbackRootId?: string;
}

export function useProjectTitleActions({
  effectiveProjectId,
  displayTitle,
  currentPage,
  activeFilePage,
  getContent,
  pdfUrl,
  fallbackRootId,
}: UseProjectTitleActionsOptions) {
  const router = useRouter();
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const { downloadPdf, exportZip, exportWord, exportMarkdown, exportHtml } = useProjectExport();
  const { updateTitle: updateTitleMutation, duplicatePage: duplicatePageMutation } = usePageActions();
  const updateProjectMutation = useUpdateProject();
  const duplicateProjectMutation = useDuplicateProject();

  const handleDownloadPdf = useCallback(() => {
    downloadPdf(pdfUrl, displayTitle);
  }, [downloadPdf, pdfUrl, displayTitle]);

  const handleDownloadZip = useCallback(() => {
    const rootId = effectiveProjectId || fallbackRootId || currentPage?.id;
    if (!rootId) {
      toast.error('Unable to find project or document ID');
      return;
    }
    exportZip({
      parentPageId: rootId,
      projectTitle: displayTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  }, [effectiveProjectId, fallbackRootId, currentPage?.id, displayTitle, getContent, activeFilePage, exportZip]);

  const handleExportWord = useCallback(() => {
    const docId = currentPage?.id || effectiveProjectId;
    if (!docId) {
      toast.error('Unable to find document content');
      return;
    }
    exportWord({
      pageId: docId,
      projectTitle: displayTitle,
    });
  }, [currentPage?.id, effectiveProjectId, displayTitle, exportWord]);

  const handleExportMarkdown = useCallback(() => {
    const docId = currentPage?.id || effectiveProjectId;
    exportMarkdown({
      pageId: docId || '',
      projectTitle: displayTitle,
      fallbackContent: getContent(),
    });
  }, [currentPage?.id, effectiveProjectId, displayTitle, getContent, exportMarkdown]);

  const handleExportHtml = useCallback(() => {
    exportHtml({
      content: getContent(),
      projectTitle: displayTitle,
    });
  }, [getContent, displayTitle, exportHtml]);

  const handleApplyRename = useCallback(
    async (newName: string): Promise<boolean> => {
      const trimmed = newName.trim();
      if (!trimmed) return false;

      setIsSubmittingAction(true);
      try {
        if (effectiveProjectId) {
          await updateProjectMutation.mutateAsync({
            projectId: effectiveProjectId,
            name: trimmed,
          });
        }

        if (currentPage?.id) {
          await updateTitleMutation.mutateAsync({
            pageId: currentPage.id,
            title: trimmed,
            oldTitle: displayTitle,
          });
        }

        toast.success(`Project renamed to "${trimmed}"`);
        return true;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to rename project');
        return false;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [effectiveProjectId, currentPage?.id, displayTitle, updateProjectMutation, updateTitleMutation],
  );

  const handleApplyCopy = useCallback(
    async (copyName: string): Promise<boolean> => {
      const trimmed = copyName.trim();
      if (!trimmed) return false;

      setIsSubmittingAction(true);
      try {
        if (effectiveProjectId) {
          const res = (await duplicateProjectMutation.mutateAsync({
            projectId: effectiveProjectId,
          })) as any;

          const newProjId = res?.project?.id || res?.data?.project?.id || res?.id;
          if (newProjId) {
            toast.success(`Created copy: "${trimmed}"`);
            router.push(`/projects/${newProjId}/pages`);
            return true;
          }
        } else if (currentPage?.id) {
          await duplicatePageMutation.mutateAsync(currentPage.id);
          toast.success(`Created copy: "${trimmed}"`);
          return true;
        }
        return false;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to create copy');
        return false;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [effectiveProjectId, currentPage?.id, duplicateProjectMutation, duplicatePageMutation, router],
  );

  return {
    isSubmittingAction,
    handleDownloadPdf,
    handleDownloadZip,
    handleExportWord,
    handleExportMarkdown,
    handleExportHtml,
    handleApplyRename,
    handleApplyCopy,
  };
}
