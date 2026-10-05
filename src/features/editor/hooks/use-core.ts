'use client';

/**
 * use-core.ts
 *
 * Clean Presentational Core Hooks for Editor UI:
 * - Query Keys & Options (backward compatibility)
 * - useActiveDocument() with resilient state fallback
 * - usePageActions() & useFileActions() UI state mutations
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { pageService, fileService } from '../services/core.service';
import { manuscriptService } from '../services/manuscript.service';
import { usePageStore, useTabsStore, useSettingsStore } from '../store';
import { getDemoManuscript } from '../mock/demo-dataset';
import { toast } from 'sonner';
import type { Page, PageFile } from '../types';

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['pages'] as const,
  detail: (pageId: string) => ['pages', 'detail', pageId] as const,
  files: (pageId: string) => ['pages', 'detail', pageId, 'files'] as const,
  deletedFiles: (pageId: string) => ['pages', 'detail', pageId, 'deleted-files'] as const,
};

export const editorPageKeys = pageKeys;

// ── 2. Query Options ─────────────────────────────────────────────────────────

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => {
      if (!pageId || pageId === 'demo' || pageId.startsWith('demo-') || pageId.startsWith('mock-')) {
        return getDemoManuscript(pageId || 'demo').page;
      }
      try {
        const page = await pageService.getById(pageId);
        if (page && (page.content || page.title)) return page;
        return getDemoManuscript(pageId).page;
      } catch {
        return getDemoManuscript(pageId).page;
      }
    },
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId || pageId === 'demo' || pageId.startsWith('demo-') || pageId.startsWith('mock-')) {
        return getDemoManuscript(pageId || 'demo').files;
      }
      try {
        const files = await fileService.getByPageId(pageId);
        if (files && files.length > 0) return files;
        return getDemoManuscript(pageId).files;
      } catch {
        return getDemoManuscript(pageId).files;
      }
    },
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      try {
        return await fileService.getDeletedByPageId(pageId);
      } catch {
        return [];
      }
    },
  });

export const pageDetailQueryOptions = pageQuery;
export const pageFilesQueryOptions = filesQuery;
export const pageDeletedFilesQueryOptions = deletedFilesQuery;

// ── 3. Active Document Session Hook ──────────────────────────────────────────

export function useActiveDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId, pageId } = useParams<{
    projectId?: string;
    pageId: string;
  }>();

  const searchParams = useSearchParams();
  const fileId = searchParams.get('file');

  const { data: serverPage, isLoading: parentLoading } = useQuery({
    ...pageQuery(pageId || ''),
    enabled: !!pageId,
  });

  const { data: serverFiles = [], isLoading: filesLoading } = useQuery({
    ...filesQuery(pageId || ''),
    enabled: !!pageId,
  });

  const demoData = useMemo(
    () => getDemoManuscript(pageId || 'demo', projectId || 'adam-research'),
    [pageId, projectId],
  );

  const fallbackPage: Page = demoData.page;
  const fallbackFiles: PageFile[] = demoData.files;

  const parentPage = serverPage || fallbackPage;
  const childFiles = serverFiles && serverFiles.length > 0 ? serverFiles : fallbackFiles;

  const isMainFile = !fileId || fileId === pageId || fileId === parentPage?.id;

  const activeFile = useMemo(() => {
    if (!fileId || isMainFile) return undefined;
    const direct = childFiles.find((f) => f.id === fileId || f.title === fileId);
    if (direct) return direct;
    const idxMatch = fileId.match(/-file-(\d+)$/);
    if (idxMatch) {
      const idx = parseInt(idxMatch[1], 10) - 1;
      if (idx >= 0 && idx < childFiles.length) return childFiles[idx];
    }
    return undefined;
  }, [fileId, isMainFile, childFiles]);

  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const setFileHierarchy = usePageStore((s) => s.setFileHierarchy);
  const setActivePageId = usePageStore((s) => s.setActivePageId);
  const setParentPageId = usePageStore((s) => s.setParentPageId);
  const setProjectId = usePageStore((s) => s.setProjectId);
  const activePageId = usePageStore((s) => s.activePageId);

  const openTab = useTabsStore((s) => s.openTab);
  const setActive = useTabsStore((s) => s.setActive);
  const parentProjectId =
    typeof parentPage?.projectId === 'object'
      ? parentPage?.projectId?.id
      : parentPage?.projectId;
  const effectiveProjectId = projectId || parentProjectId || null;

  useEffect(() => {
    if (effectiveProjectId && typeof setProjectId === 'function') setProjectId(effectiveProjectId);
    if (pageId && typeof setParentPageId === 'function') setParentPageId(pageId);
  }, [effectiveProjectId, pageId, setProjectId, setParentPageId]);

  useEffect(() => {
    if (parentPage && typeof setFileHierarchy === 'function') {
      setFileHierarchy(parentPage);
    }
  }, [parentPage, setFileHierarchy]);

  useEffect(() => {
    if (!parentPage) return;

    if (isMainFile) {
      const mainId =
        typeof parentPage.mainFile === 'string'
          ? parentPage.mainFile
          : (parentPage.mainFile as Page | undefined)?.id;
      const mainFile = childFiles.find(
        (f) => f.id === mainId || f.id === (parentPage as { mainFileId?: string }).mainFileId
      );
      const targetPage = mainFile || parentPage;

      setCurrentPage?.(targetPage);
      setActivePageId?.(targetPage.id);

      if (pageId) {
        openTab(pageId, {
          id: targetPage.id,
          title: targetPage.title || 'main.tex',
        });
        setActive(pageId, targetPage.id);
      }
      if (projectId && projectId !== pageId) {
        openTab(projectId, {
          id: targetPage.id,
          title: targetPage.title || 'main.tex',
        });
        setActive(projectId, targetPage.id);
      }
    } else if (activeFile) {
      setCurrentPage?.(activeFile);
      setActivePageId?.(activeFile.id);

      if (pageId) {
        openTab(pageId, {
          id: activeFile.id,
          title: activeFile.title,
        });
        setActive(pageId, activeFile.id);
      }
      if (projectId && projectId !== pageId) {
        openTab(projectId, {
          id: activeFile.id,
          title: activeFile.title,
        });
        setActive(projectId, activeFile.id);
      }
    }
  }, [
    isMainFile,
    fileId,
    pageId,
    projectId,
    parentPage,
    activeFile,
    childFiles,
    setCurrentPage,
    setActivePageId,
    openTab,
    setActive,
  ]);

  const selectFile = useCallback((targetFileId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetFileId === pageId || targetFileId === parentPage?.id) {
      params.delete('file');
    } else {
      params.set('file', targetFileId);
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }, [searchParams, pageId, parentPage?.id, router, pathname]);

  const activeTabId = useTabsStore((s) =>
    (pageId ? s.activeByProject[pageId] : null) ||
    (projectId ? s.activeByProject[projectId] : null) ||
    null
  );
  const selectedAsset = usePageStore((s) => s.selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = (isMainFile ? parentPage : activeFile) || parentPage;
  const displayPage = isAssetTab ? null : activePage;

  return {
    parentPage,
    activePage,
    displayPage,
    childFiles,
    isLoading: parentLoading && filesLoading && !parentPage,
    selectFile,
    activePageId,
    pageId,
    fileId,
    isAssetTab,
    selectedAsset,
    projectId: effectiveProjectId,
  };
}

// ── 4. Page Actions Hook ─────────────────────────────────────────────────────

export function usePageActions() {
  const { isLocked } = useSettingsStore();
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const queryClient = useQueryClient();

  const updateContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) throw new Error('Document is locked');
      setCurrentPage((prev: Page | null) => (prev ? { ...prev, content } : prev));
      return await manuscriptService.docs.updateContent(pageId, content);
    },
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save document content';
      toast.error(msg);
    },
  });

  const updateThumbnailMutation = useMutation({
    mutationFn: async ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) => {
      return await manuscriptService.docs.updateThumbnail(pageId, dataUrl);
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      setCurrentPage((prev: Page | null) => (prev ? { ...prev, title } : prev));
      return await manuscriptService.docs.updateTitle(pageId, title, oldTitle);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success(`Renamed to "${variables.title}"`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to rename file';
      toast.error(msg);
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await manuscriptService.docs.delete(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('File deleted');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(msg);
    },
  });

  const restorePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await manuscriptService.docs.restore(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('File restored');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to restore file';
      toast.error(msg);
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await manuscriptService.docs.duplicate(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('File duplicated');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate file';
      toast.error(msg);
    },
  });

  return {
    updateContent: updateContentMutation,
    updateThumbnail: updateThumbnailMutation,
    updateTitle: updateTitleMutation,
    deletePage: deletePageMutation,
    restorePage: restorePageMutation,
    duplicatePage: duplicatePageMutation,
  };
}

// ── 5. File Actions Hook ─────────────────────────────────────────────────────

export function useFileActions() {
  const { isLocked } = useSettingsStore();
  const queryClient = useQueryClient();

  const createFileMutation = useMutation({
    mutationFn: async ({ parentPageId, title, content }: { parentPageId: string; title: string; content?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      return await fileService.create({ parentPageId, title, content });
    },
    onSuccess: (newFile, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(variables.parentPageId) });
      toast.success(`Created file "${newFile.title}"`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create file';
      toast.error(msg);
    },
  });

  const setMainFileMutation = useMutation({
    mutationFn: async ({ pageId, fileId }: { pageId: string; fileId: string }) => {
      if (isLocked) throw new Error('Document is locked');
      return await fileService.setMain({ pageId, fileId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success('Set as main document');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set main document';
      toast.error(msg);
    },
  });

  return {
    createFile: createFileMutation,
    setMainFile: setMainFileMutation,
  };
}
