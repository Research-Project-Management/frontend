'use client';

/**
 * useProjectTitleActions.ts
 *
 * Dedicated custom hook encapsulating topbar project actions and notifications:
 * - PDF download
 * - Source & arXiv ZIP export
 * - Word / Markdown / HTML single-document export
 * - Project renaming & duplication
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import { useProjectExport } from '@/features/editor/core/hooks/useExport';
import { usePageStore } from '@/features/editor/core/store/editor.store';
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

  const resolveTargetDocId = useCallback((): string => {
    const store = usePageStore.getState();
    return (
      store.rootDocId ||
      activeFilePage?.id ||
      store.activeDocId ||
      currentPage?.id ||
      fallbackRootId ||
      ''
    );
  }, [activeFilePage?.id, currentPage?.id, fallbackRootId]);

  const handleDownloadPdf = useCallback(() => {
    void downloadPdf(pdfUrl, displayTitle);
  }, [downloadPdf, pdfUrl, displayTitle]);

  const handleDownloadZip = useCallback(() => {
    const pageId = currentPage?.id || fallbackRootId;
    const spaceId = effectiveProjectId || pageId;
    if (!spaceId && !pageId) {
      toast.error('Unable to find project or document ID');
      return;
    }
    void exportZip({
      spaceId: spaceId || undefined,
      parentPageId: pageId || spaceId || '',
      pageId: pageId || undefined,
      projectTitle: displayTitle,
    });
  }, [effectiveProjectId, fallbackRootId, currentPage?.id, displayTitle, exportZip]);

  const handleDownloadArxiv = useCallback(() => {
    const pageId = currentPage?.id || fallbackRootId;
    const spaceId = effectiveProjectId || pageId;
    if (!spaceId && !pageId) {
      toast.error('Unable to find project or document ID');
      return;
    }
    void exportArxiv({
      spaceId: spaceId || undefined,
      parentPageId: pageId || spaceId || '',
      pageId: pageId || undefined,
      projectTitle: displayTitle,
    });
  }, [effectiveProjectId, fallbackRootId, currentPage?.id, displayTitle, exportArxiv]);

  const handleExportWord = useCallback(() => {
    const docId = resolveTargetDocId();
    if (!docId) {
      toast.error('Unable to find document content');
      return;
    }
    void exportWord({
      docId,
      projectTitle: displayTitle,
    });
  }, [resolveTargetDocId, displayTitle, exportWord]);

  const handleExportMarkdown = useCallback(() => {
    const docId = resolveTargetDocId();
    if (!docId) {
      toast.error('Unable to find document content');
      return;
    }
    void exportMarkdown({
      docId,
      projectTitle: displayTitle,
    });
  }, [resolveTargetDocId, displayTitle, exportMarkdown]);

  const handleExportHtml = useCallback(() => {
    const docId = resolveTargetDocId();
    if (!docId) {
      toast.error('Unable to find document content');
      return;
    }
    void exportHtml({
      docId,
      projectTitle: displayTitle,
    });
  }, [resolveTargetDocId, displayTitle, exportHtml]);

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
        toast.success('Document duplicated', { id: toastId });
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
