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
import { usePageActions } from '@/features/editor/ui/hooks/usePageActions';
import { useProjectExport } from '@/features/editor/ui/hooks/useExport';
import { useUpdateProject, useDuplicateProject } from '@/features/projects/shell/hooks/use-project';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';

export interface UseProjectTitleActionsOptions {
  effectiveProjectId: string;
  displayTitle: string;
  currentPage?: Pick<Page | PageFile, 'id' | 'title'> | null;
  activeFilePage?: Pick<Page | PageFile, 'id' | 'title'> | null;
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

  const {
    isExporting,
    downloadPdf,
    downloadCopy,
    exportZip,
    exportArxiv,
    exportWord,
    exportMarkdown,
    exportHtml,
  } = useProjectExport();
  const { updateTitle: updateTitleMutation, duplicatePage: duplicatePageMutation } = usePageActions();

  const handleDownloadPdf = useCallback(() => {
    downloadPdf(pdfUrl, displayTitle);
  }, [downloadPdf, pdfUrl, displayTitle]);

  const handleDownloadZip = useCallback(() => {
    const rootId = fallbackRootId || effectiveProjectId || currentPage?.id;
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
  }, [effectiveProjectId, fallbackRootId, currentPage?.id, displayTitle, getContent, activeFilePage?.id, activeFilePage?.title, exportZip]);

  const handleDownloadArxiv = useCallback(() => {
    const rootId = fallbackRootId || effectiveProjectId || currentPage?.id;
    if (!rootId) {
      toast.error('Unable to find project or document ID');
      return;
    }
    exportArxiv({
      parentPageId: rootId,
      projectTitle: displayTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  }, [effectiveProjectId, fallbackRootId, currentPage?.id, displayTitle, getContent, activeFilePage?.id, activeFilePage?.title, exportArxiv]);

  const handleExportWord = useCallback(() => {
    const docId = fallbackRootId || effectiveProjectId || currentPage?.id;
    if (!docId) {
      toast.error('Unable to find document content');
      return;
    }
    exportWord({
      pageId: docId,
      projectTitle: displayTitle,
    });
  }, [fallbackRootId, currentPage?.id, effectiveProjectId, displayTitle, exportWord]);

  const handleExportMarkdown = useCallback(() => {
    const docId = fallbackRootId || effectiveProjectId || currentPage?.id;
    exportMarkdown({
      pageId: docId || '',
      projectTitle: displayTitle,
      fallbackContent: getContent(),
    });
  }, [fallbackRootId, currentPage?.id, effectiveProjectId, displayTitle, getContent, exportMarkdown]);

  const handleExportHtml = useCallback(() => {
    const docId = fallbackRootId || effectiveProjectId || currentPage?.id;
    exportHtml({
      pageId: docId || '',
      content: getContent(),
      projectTitle: displayTitle,
    });
  }, [fallbackRootId, effectiveProjectId, currentPage?.id, getContent, displayTitle, exportHtml]);

  const handleApplyRename = useCallback(
    async (newName: string): Promise<boolean> => {
      const trimmed = newName.trim();
      if (!trimmed) return false;

      const targetPageId = currentPage?.id || fallbackRootId;
      if (!targetPageId) return false;

      setIsSubmittingAction(true);
      try {
        await updateTitleMutation.mutateAsync({
          pageId: targetPageId,
          title: trimmed,
          oldTitle: displayTitle,
        });

        toast.success(`Document renamed to "${trimmed}"`, { id: 'rename-project' });
        return true;
      } catch (err: unknown) {
        toast.error((err as Error)?.message || 'Failed to rename document', { id: 'rename-project' });
        return false;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [currentPage?.id, fallbackRootId, displayTitle, updateTitleMutation],
  );

  const handleMakeCopy = useCallback(async () => {
    const targetPageId = currentPage?.id || fallbackRootId;
    if (targetPageId) {
      const toastId = toast.loading('Duplicating document...');
      setIsSubmittingAction(true);
      try {
        const res = (await duplicatePageMutation.mutateAsync(targetPageId)) as {
          page?: { id?: string };
          rootPageId?: string;
          id?: string;
        } | null;
        const newPageId = res?.page?.id || res?.rootPageId || res?.id;
        toast.success('Document duplicated successfully!', { id: toastId });
        if (newPageId) {
          const isPersonal = !effectiveProjectId || effectiveProjectId === 'personal' || effectiveProjectId === targetPageId;
          router.push(isPersonal ? `/pages/${newPageId}` : `/projects/${effectiveProjectId}/pages/${newPageId}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to duplicate document, downloading backup file instead.';
        toast.error(message, { id: toastId });
        downloadCopy(getContent(), activeFilePage?.title || displayTitle);
      } finally {
        setIsSubmittingAction(false);
      }
    } else {
      downloadCopy(getContent(), activeFilePage?.title || displayTitle);
    }
  }, [currentPage?.id, fallbackRootId, effectiveProjectId, duplicatePageMutation, router, downloadCopy, getContent, activeFilePage?.title, displayTitle]);

  return {
    isSubmittingAction,
    isCopying: isSubmittingAction,
    isExporting,
    handleDownloadPdf,
    handleDownloadZip,
    handleDownloadArxiv,
    handleExportWord,
    handleExportMarkdown,
    handleExportHtml,
    handleApplyRename,
    handleMakeCopy,
  };
}
