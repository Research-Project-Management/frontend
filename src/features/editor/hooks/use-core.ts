'use client';

/**
 * use-core.ts
 *
 * Frontend hooks mirroring Backend `modules/document/core/`:
 *  - Page & File query keys and options
 *  - useActiveDocument() session hook
 *  - usePageActions() mutation hooks
 *  - useFileActions() mutation hooks
 */

import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { pageService, fileService } from '../services/core.service';
import { usePageStore, useTabsStore, useSettingsStore } from '../store';
import { EditorEventBus } from '../utils/editor.util';
import { toast } from 'sonner';

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['pages'] as const,
  detail: (pageId: string) => ['pages', 'detail', pageId] as const,
  files: (pageId: string) => ['pages', 'detail', pageId, 'files'] as const,
};

export const editorPageKeys = pageKeys;

// ── 2. Query Options ─────────────────────────────────────────────────────────

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: () => pageService.getById(pageId),
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: () => fileService.getByPageId(pageId),
  });

export const pageDetailQueryOptions = pageQuery;
export const pageFilesQueryOptions = filesQuery;

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

  const { data: parentPage, isLoading: parentLoading } = useQuery({
    ...pageQuery(pageId!),
    enabled: !!pageId,
  });

  const { data: childFiles = [], isLoading: filesLoading } = useQuery({
    ...filesQuery(pageId!),
    enabled: !!pageId,
  });

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

  useEffect(() => {
    if (projectId && typeof setProjectId === 'function') setProjectId(projectId);
    if (pageId && typeof setParentPageId === 'function') setParentPageId(pageId);
  }, [projectId, pageId, setProjectId, setParentPageId]);

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

  const selectFile = (targetFileId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetFileId === pageId) {
      params.delete('file');
    } else {
      params.set('file', targetFileId);
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  };

  const activeTabId = (pageId ? tabsStore.getActive(pageId) : null) || (projectId ? tabsStore.getActive(projectId) : null);
  const selectedAsset = usePageStore((s) => (s as any).selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = fileId ? activeFile : parentPage;
  const displayPage = isAssetTab ? null : activePage;

  return {
    parentPage,
    activePage,
    displayPage,
    childFiles,
    isLoading: parentLoading || filesLoading,
    selectFile,
    activePageId,
    pageId,
    fileId,
    isAssetTab,
    selectedAsset,
  };
}

// ── 4. Page Actions Hook ─────────────────────────────────────────────────────

export function usePageActions() {
  const queryClient = useQueryClient();
  const { isLocked } = useSettingsStore() as any;

  const updateContent = useMutation({
    mutationFn: ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) {
        throw new Error('Tài liệu đang bị khóa');
      }
      return pageService.updateContent(pageId, content);
    },
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(updatedPage.id), updatedPage);
      queryClient.invalidateQueries({
        queryKey: pageKeys.files((updatedPage as any).parentPageId || updatedPage.id),
      });
    },
  });

  const updateThumbnail = useMutation({
    mutationFn: ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) =>
      pageService.updateThumbnail(pageId, dataUrl),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(updatedPage.id), updatedPage);
    },
  });

  const updateTitle = useMutation({
    mutationFn: ({
      pageId,
      title,
      oldTitle,
    }: {
      pageId: string;
      title: string;
      oldTitle?: string;
    }) => {
      if (isLocked) {
        throw new Error('Tài liệu đang bị khóa');
      }
      return pageService.updateTitle(pageId, title, oldTitle);
    },
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(updatedPage.id), updatedPage);
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Đã đổi tên tài liệu');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi đổi tên tài liệu');
    },
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => {
      if (isLocked) {
        throw new Error('Tài liệu đang bị khóa');
      }
      return pageService.deletePage(pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Đã xóa trang');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi xóa trang');
    },
  });

  return {
    updateContent,
    updateThumbnail,
    updateTitle,
    deletePage,
  };
}

// ── 5. File Actions Hook ─────────────────────────────────────────────────────

export function useFileActions() {
  const queryClient = useQueryClient();
  const { isLocked } = useSettingsStore() as any;

  const createFile = useMutation({
    mutationFn: (payload: { parentPageId: string; title: string; content?: string }) => {
      if (isLocked) {
        throw new Error('Tài liệu đang bị khóa');
      }
      return fileService.create(payload);
    },
    onSuccess: (newFile, { parentPageId }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
      toast.success('Đã tạo tệp mới');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi tạo tệp');
    },
  });

  const setMainFile = useMutation({
    mutationFn: (payload: { pageId: string; fileId: string }) => {
      if (isLocked) {
        throw new Error('Tài liệu đang bị khóa');
      }
      return fileService.setMain(payload);
    },
    onSuccess: (updatedPage) => {
      queryClient.setQueryData(pageKeys.detail(updatedPage.id), updatedPage);
      toast.success('Đã đặt làm tệp chính');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi đặt tệp chính');
    },
  });

  return {
    createFile,
    setMainFile,
  };
}
