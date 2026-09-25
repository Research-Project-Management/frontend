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
      try {
        return await pageService.getById(pageId);
      } catch {
        return null;
      }
    },
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      try {
        return await fileService.getByPageId(pageId);
      } catch {
        return [];
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

const DEFAULT_SAMPLE_LATEX = `\\documentclass{article}
\\usepackage{graphicx}

\\title{Overleaf Research Document}
\\author{Researcher}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to your LaTeX manuscript editor. This workspace is ready for writing, reviewing, and compiling LaTeX documents.

\\section{Formulas}
Here is a sample equation:
\\begin{equation}
  E = mc^2
\\end{equation}

\\section{Conclusion}
Start editing on the left and see the real-time compiled PDF on the right.

\\end{document}`;

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

  const fallbackPage: Page = useMemo(
    () => ({
      id: pageId || 'main-page',
      title: 'main.tex',
      content: DEFAULT_SAMPLE_LATEX,
      projectId: projectId || 'current-project',
      status: 'published',
      author: {
        id: 'me',
        name: 'Researcher',
      },
      views: 1,
      lastAccessedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [pageId, projectId],
  );

  const fallbackFiles: PageFile[] = useMemo(
    () => [
      {
        id: pageId || 'main-file',
        pageId: pageId || 'main-page',
        title: 'main.tex',
        content: DEFAULT_SAMPLE_LATEX,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    [pageId],
  );

  const parentPage = serverPage || fallbackPage;
  const childFiles = serverFiles.length > 0 ? serverFiles : fallbackFiles;
  const activeFile = childFiles.find((f) => f.id === fileId);

  const pageStore = usePageStore();
  const {
    setCurrentPage,
    setFileHierarchy,
    setActivePageId,
    setParentPageId,
    setProjectId,
    activePageId,
  } = pageStore;

  const tabsStore = useTabsStore();
  const { openTab, setActive } = tabsStore;

  const effectiveProjectId = projectId || (parentPage as any)?.projectId || null;

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

    if (!fileId) {
      const mainFile = childFiles.find((f) => f.id === (parentPage as any).mainFileId);
      const targetPage = mainFile || parentPage;

      setCurrentPage?.(targetPage);
      setActivePageId?.(targetPage.id);

      if (pageId) {
        openTab(pageId, {
          id: targetPage.id,
          title: targetPage.title,
        });
        setActive(pageId, targetPage.id);
      }
      if (projectId && projectId !== pageId) {
        openTab(projectId, {
          id: targetPage.id,
          title: targetPage.title,
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
    if (targetFileId === pageId) {
      params.delete('file');
    } else {
      params.set('file', targetFileId);
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }, [searchParams, pageId, router, pathname]);

  const activeTabId =
    (pageId ? tabsStore.getActive(pageId) : null) ||
    (projectId ? tabsStore.getActive(projectId) : null);
  const selectedAsset = usePageStore((s) => (s as any).selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = fileId ? activeFile : parentPage;
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
  const { isLocked } = useSettingsStore() as any;
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const queryClient = useQueryClient();

  const updateContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      setCurrentPage((prev: any) => (prev ? { ...prev, content } : prev));
      return await manuscriptService.docs.updateContent(pageId, content);
    },
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể lưu nội dung');
    },
  });

  const updateThumbnailMutation = useMutation({
    mutationFn: async ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) => {
      return await manuscriptService.docs.updateThumbnail(pageId, dataUrl);
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ pageId, title }: { pageId: string; title: string }) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      setCurrentPage((prev: any) => (prev ? { ...prev, title } : prev));
      return await manuscriptService.docs.updateTitle(pageId, title);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success('Đã đổi tên tài liệu');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể đổi tên tài liệu');
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      return await manuscriptService.docs.delete(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Đã xóa trang');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa trang');
    },
  });

  const restorePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      return await manuscriptService.docs.restore(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Đã khôi phục tệp');
    },
  });

  return {
    updateContent: updateContentMutation as any,
    updateThumbnail: updateThumbnailMutation as any,
    updateTitle: updateTitleMutation as any,
    deletePage: deletePageMutation as any,
    restorePage: restorePageMutation as any,
  };
}

// ── 5. File Actions Hook ─────────────────────────────────────────────────────

export function useFileActions() {
  const { isLocked } = useSettingsStore() as any;
  const queryClient = useQueryClient();

  const createFileMutation = useMutation({
    mutationFn: async ({ parentPageId, title, content }: { parentPageId: string; title: string; content?: string }) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      return await fileService.create({ parentPageId, title, content });
    },
    onSuccess: (newFile, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(variables.parentPageId) });
      toast.success(`Đã tạo tệp "${newFile.title}"`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể tạo tệp');
    },
  });

  const setMainFileMutation = useMutation({
    mutationFn: async ({ pageId, fileId }: { pageId: string; fileId: string }) => {
      if (isLocked) throw new Error('Tài liệu đang bị khóa');
      return await fileService.setMain({ pageId, fileId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success('Đã đặt làm tệp chính');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể đặt làm tệp chính');
    },
  });

  return {
    createFile: createFileMutation as any,
    setMainFile: setMainFileMutation as any,
  };
}
