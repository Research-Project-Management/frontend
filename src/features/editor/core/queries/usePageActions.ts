'use client';

/**
 * usePageActions.ts
 *
 * Page State Mutation Hook:
 * - Content updates
 * - Title updates & project tabs synchronization
 * - Thumbnail updates
 * - Delete, restore, and duplicate page operations
 *
 * Layer 4: Presentation / UI Hooks.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  workspaceCoordinator,
  sessionCoordinator,
  usePageStore,
  useWorkspaceStore,
  useSettingsStore,
  editorCommandBus,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { updateActiveYjsDocContent } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { pageKeys, invalidateFileTreeQueries } from './document.queries';
import { toast } from 'sonner';

export function usePageActions() {
  const isLocked = useSettingsStore((s) => s.isLocked);
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const queryClient = useQueryClient();

  const createFileMutation = useMutation({
    mutationFn: async ({
      parentPageId,
      title,
      content,
    }: {
      parentPageId: string;
      title: string;
      content?: string;
      skipInvalidation?: boolean;
      silent?: boolean;
    }) => {
      if (isLocked) throw new Error('Document is locked');
      return await pagesService.docs.createChildFile({ parentPageId, title, content });
    },
    onSuccess: (newFile, variables) => {
      if (!variables.skipInvalidation) {
        invalidateFileTreeQueries(queryClient, {
          parentPageId: variables.parentPageId,
          includeDeleted: false,
        });
        editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create file';
      toast.error(msg, { id: 'create-file-error' });
    },
  });

  const setMainFileMutation = useMutation({
    mutationFn: async (params: string | { pageId: string; fileId: string; projectId?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      const fileId = typeof params === 'string' ? params : params.fileId;
      const targetId = typeof params === 'string' ? undefined : (params.pageId || params.projectId);
      return await workspaceCoordinator.setMainFile(fileId, targetId);
    },
    onSuccess: (_, variables) => {
      const targetPageId = typeof variables === 'string' ? variables : variables.pageId;
      invalidateFileTreeQueries(queryClient, {
        parentPageId: targetPageId,
        pageId: targetPageId,
        includeDeleted: false,
        includeRootDoc: true,
        includeProjects: false,
      });
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) throw new Error('Document is locked');
      setCurrentPage((prev) => (prev && prev.id === pageId ? { ...prev, content } : prev));
      lruDocumentCache.updateContent(pageId, content, true);
      const updatedYjs = updateActiveYjsDocContent(pageId, content);
      const isYjsActive = updatedYjs || sessionCoordinator.isRealtimeConnected(pageId);
      if (isYjsActive) {
        if (!updatedYjs) {
          editorCommandBus.dispatch({ type: 'editor:set-content', content, fileId: pageId });
        }
        sessionCoordinator.notifyContentChange(pageId, content, { isRealtimeActive: true });
        await sessionCoordinator.flushFile(pageId);
        return { id: pageId, content };
      }
      const expectedRev = lruDocumentCache.getModel(pageId)?.serverRev;
      const res =
        expectedRev !== undefined
          ? await pagesService.docs.updateContent(pageId, content, { expectedRev })
          : await pagesService.docs.updateContent(pageId, content);
      if (res && typeof res === 'object') {
        const r = res as {
          rev?: number;
          updatedAt?: string;
          page?: { rev?: number; updatedAt?: string };
        };
        const nextRev = r.rev ?? r.page?.rev;
        const nextUpdatedAt = r.updatedAt ?? r.page?.updatedAt;
        if (nextRev !== undefined || nextUpdatedAt !== undefined) {
          lruDocumentCache.updateServerVersion(pageId, {
            rev: nextRev,
            updatedAt: nextUpdatedAt,
          });
        }
      }
      lruDocumentCache.markClean(pageId);
      return res;
    },
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
    },
    onError: (err: unknown, vars) => {
      const msg = err instanceof Error ? err.message : 'Failed to save document content';
      toast.error(msg, { id: `save-content-${vars.pageId}` });
    },
  });

  const updateThumbnailMutation = useMutation({
    mutationFn: async ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) => {
      return await pagesService.docs.updateThumbnail(pageId, dataUrl);
    },
  });

  const updateTitleMutation = useMutation({
    onMutate: () => {
      const pageStore = usePageStore.getState();
      return {
        prevActiveFilePage: pageStore.activeFilePage,
        prevCurrentPage: pageStore.currentPage,
        prevWorkspaceTitle: pageStore.workspaceTitle,
      };
    },
    mutationFn: async ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      const pageStore = usePageStore.getState();
      if (pageStore.activeFilePage?.id === pageId) {
        pageStore.setActiveFilePage({ ...pageStore.activeFilePage, title });
      }
      if (pageStore.currentPage?.id === pageId) {
        setCurrentPage((prev) => (prev && prev.id === pageId ? { ...prev, title } : prev));
      }
      if (
        pageId === pageStore.rootPageId ||
        pageId === pageStore.parentPageId ||
        pageId === pageStore.currentPage?.id
      ) {
        pageStore.setWorkspaceTitle(title);
      }
      return await pagesService.docs.updateTitle(pageId, title, oldTitle);
    },
    onSuccess: (_, variables) => {
      const parentPageId =
        usePageStore.getState().parentPageId ||
        usePageStore.getState().currentPage?.id;
      invalidateFileTreeQueries(queryClient, {
        parentPageId,
        pageId: variables.pageId,
        includeDeleted: false,
      });

      // Synchronize open tabs across projects
      const tabsState = useWorkspaceStore.getState();
      Object.keys(tabsState.tabsByProject).forEach((projId) => {
        tabsState.updateTabTitle(projId, variables.pageId, variables.title);
      });

      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    onError: (err: unknown, variables, context) => {
      const pageStore = usePageStore.getState();
      if (context) {
        if (context.prevActiveFilePage !== undefined) {
          pageStore.setActiveFilePage(context.prevActiveFilePage);
        }
        if (context.prevCurrentPage !== undefined) {
          setCurrentPage(context.prevCurrentPage);
        }
        if (context.prevWorkspaceTitle !== undefined) {
          pageStore.setWorkspaceTitle(context.prevWorkspaceTitle);
        }
      }
      const msg = err instanceof Error ? err.message : 'Failed to rename file';
      toast.error(msg, { id: `rename-file-${variables.pageId}` });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      const ok = await workspaceCoordinator.deleteFile(pageId);
      if (!ok) {
        throw new Error('Failed to delete file');
      }
      return { success: true };
    },
    onSuccess: () => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      invalidateFileTreeQueries(queryClient, { parentPageId });
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const restorePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await workspaceCoordinator.restoreFile(pageId);
    },
    onSuccess: (_, pageId) => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      invalidateFileTreeQueries(queryClient, { parentPageId, pageId });
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await pagesService.docs.duplicate(pageId);
    },
    onSuccess: () => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      invalidateFileTreeQueries(queryClient, { parentPageId, includeDeleted: false });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    onError: (err: unknown, pageId) => {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate page';
      toast.error(msg, { id: `duplicate-file-${pageId}` });
    },
  });

  return {
    createFile: createFileMutation,
    setMainFile: setMainFileMutation,
    updateContent: updateContentMutation,
    updateThumbnail: updateThumbnailMutation,
    updateTitle: updateTitleMutation,
    deletePage: deletePageMutation,
    restorePage: restorePageMutation,
    duplicatePage: duplicatePageMutation,
  };
}
