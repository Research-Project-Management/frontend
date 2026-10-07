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
      if (!pageId) throw new Error('Missing pageId');
      return await pageService.getById(pageId);
    },
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await fileService.getByPageId(pageId);
    },
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await fileService.getDeletedByPageId(pageId);
    },
  });

export const pageDetailQueryOptions = pageQuery;
export const pageFilesQueryOptions = filesQuery;
export const pageDeletedFilesQueryOptions = deletedFilesQuery;

// ── 3. Active Document Session Hook ──────────────────────────────────────────

export function useActiveDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId: rawProjectId, pageId: rawPageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const pageId = rawPageId || draftId || '';
  const projectId = rawProjectId || undefined;

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

  const parentPage = serverPage || null;
  const childFiles = serverFiles || [];

  const mainId =
    typeof parentPage?.mainFile === 'string'
      ? parentPage.mainFile
      : (parentPage?.mainFile as Page | undefined)?.id ||
        (parentPage as { mainFileId?: string })?.mainFileId;

  const activeTabId = useTabsStore((s) =>
    (pageId ? s.activeByProject[pageId] : null) ||
    (projectId ? s.activeByProject[projectId] : null) ||
    null
  );

  // Synchronously resolve active file ID: in-memory active tab takes precedence, falling back to searchParams (?file=...)
  const resolvedFileId = activeTabId || fileId;

  const isMainFile =
    !resolvedFileId ||
    resolvedFileId === pageId ||
    resolvedFileId === `${pageId}-main` ||
    resolvedFileId === parentPage?.id ||
    Boolean(mainId && resolvedFileId === mainId);

  // When a child file is active, query its complete content from server
  const activeFileId = !isMainFile && resolvedFileId ? resolvedFileId : null;
  const { data: activeFileDoc, isLoading: fileLoading } = useQuery({
    ...pageQuery(activeFileId || ''),
    enabled: Boolean(activeFileId),
  });

  const activeFile = useMemo(() => {
    if (!resolvedFileId || isMainFile) return undefined;
    if (activeFileDoc) return activeFileDoc;
    const meta = childFiles.find((f) => f.id === resolvedFileId || f.title === resolvedFileId);
    if (meta && typeof meta.content === 'string' && meta.content.length > 0) return meta;
    return undefined;
  }, [resolvedFileId, isMainFile, activeFileDoc, childFiles]);

  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const setFileHierarchy = usePageStore((s) => s.setFileHierarchy);
  const setActivePageId = usePageStore((s) => s.setActivePageId);
  const setParentPageId = usePageStore((s) => s.setParentPageId);
  const setProjectId = usePageStore((s) => s.setProjectId);
  const activePageId = usePageStore((s) => s.activePageId);

  const openTab = useTabsStore((s) => s.openTab);
  const setActive = useTabsStore((s) => s.setActive);
  const rawParentProj =
    typeof parentPage?.projectId === 'object'
      ? parentPage?.projectId?.id
      : parentPage?.projectId;
  const parentProjectId = rawParentProj || null;
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
      setCurrentPage?.(parentPage);
      setActivePageId?.(parentPage.id);

      const rawTitle = parentPage.title || '';
      const resolvedTitle =
        rawTitle.toLowerCase() === 'flux' || rawTitle.toLowerCase() === 'flux.tex' || !rawTitle.includes('.')
          ? 'main.tex'
          : rawTitle;

      if (pageId) {
        const existingTabs = useTabsStore.getState().tabsByProject[pageId];
        // Only seed tab if project tabs are completely uninitialized
        if (existingTabs === undefined) {
          openTab(pageId, {
            id: parentPage.id,
            title: resolvedTitle,
          });
          setActive(pageId, parentPage.id);
        }
      }
      if (projectId && projectId !== pageId) {
        const existingTabs = useTabsStore.getState().tabsByProject[projectId];
        if (existingTabs === undefined) {
          openTab(projectId, {
            id: parentPage.id,
            title: resolvedTitle,
          });
          setActive(projectId, parentPage.id);
        }
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
    resolvedFileId,
    pageId,
    projectId,
    parentPage,
    activeFile,
    setCurrentPage,
    setActivePageId,
    openTab,
    setActive,
  ]);

  const selectFile = useCallback((targetFileId: string) => {
    const isTargetMain =
      targetFileId === pageId ||
      targetFileId === parentPage?.id ||
      (mainId && targetFileId === mainId);

    const targetTabId = isTargetMain ? pageId : targetFileId;
    const targetFile = isTargetMain
      ? parentPage
      : childFiles.find((f) => f.id === targetFileId || f.title === targetFileId);

    const targetTitle = targetFile?.title || (isTargetMain ? 'main.tex' : targetFileId);

    if (pageId) {
      openTab(pageId, { id: targetTabId, title: targetTitle });
      setActive(pageId, targetTabId);
    }
    if (projectId && projectId !== pageId) {
      openTab(projectId, { id: targetTabId, title: targetTitle });
      setActive(projectId, targetTabId);
    }

    // Shallow history URL update: 0ms latency, eliminates Next.js router transitions
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (isTargetMain) {
        url.searchParams.delete('file');
      } else {
        url.searchParams.set('file', targetFileId);
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
    }
  }, [pageId, parentPage, mainId, childFiles, openTab, setActive, projectId]);

  const selectedAsset = usePageStore((s) => s.selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = isMainFile ? parentPage : (activeFile || null);
  const displayPage = isAssetTab ? null : activePage;

  const isDocumentLoading =
    (parentLoading && !parentPage) ||
    (Boolean(activeFileId) && (fileLoading || !activeFileDoc));

  return {
    parentPage,
    activePage,
    displayPage,
    childFiles,
    isLoading: isDocumentLoading,
    isChildLoading: fileLoading,
    selectFile,
    activePageId,
    pageId,
    fileId: resolvedFileId,
    isAssetTab,
    selectedAsset,
    projectId: effectiveProjectId,
  };
}

// ── 4. Page Actions Hook ─────────────────────────────────────────────────────

export function usePageActions() {
  const isLocked = useSettingsStore((s) => s.isLocked);
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
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });

      // Synchronize open tabs across projects
      const tabsState = useTabsStore.getState();
      Object.keys(tabsState.tabsByProject).forEach((projId) => {
        tabsState.updateTabTitle(projId, variables.pageId, variables.title);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
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
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
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
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
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
  const isLocked = useSettingsStore((s) => s.isLocked);
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
    mutationFn: async ({ pageId, fileId, projectId }: { pageId: string; fileId: string; projectId?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      return await fileService.setMain({ pageId, fileId, projectId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.files(variables.pageId) });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
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
