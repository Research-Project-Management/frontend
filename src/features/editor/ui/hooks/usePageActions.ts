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
import { manuscriptService, fileService } from '@/features/editor/sdk/manuscript.service';
import { workspaceCoordinator, usePageStore, useWorkspaceStore, useSettingsStore, editorCommandBus } from '@/features/editor/core';
import { pageKeys } from './document.queries';
import { toast } from 'sonner';

export function usePageActions() {
  const isLocked = useSettingsStore((s) => s.isLocked);
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const queryClient = useQueryClient();

  const createFileMutation = useMutation({
    mutationFn: async ({ parentPageId, title, content }: { parentPageId: string; title: string; content?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      return await fileService.create({ parentPageId, title, content });
    },
    onSuccess: (newFile, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(variables.parentPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });
      toast.success(`Created file "${newFile.title}"`, { id: `create-file-${newFile.id || variables.title}` });
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
      const projId = typeof params === 'string' ? undefined : (params.projectId || params.pageId);
      return await workspaceCoordinator.setMainFile(fileId, projId);
    },
    onSuccess: (_, variables) => {
      const targetPageId = typeof variables === 'string' ? variables : variables.pageId;
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(targetPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.files(targetPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['editor-root-doc'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set main document';
      toast.error(msg, { id: 'set-main-file' });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) throw new Error('Document is locked');
      setCurrentPage((prev) => (prev ? { ...prev, content } : prev));
      return await manuscriptService.docs.updateContent(pageId, content);
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
      return await manuscriptService.docs.updateThumbnail(pageId, dataUrl);
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) => {
      if (isLocked) throw new Error('Document is locked');
      const pageStore = usePageStore.getState();
      if (pageStore.activeFilePage?.id === pageId) {
        pageStore.setActiveFilePage({ ...pageStore.activeFilePage, title });
      }
      if (pageStore.currentPage?.id === pageId) {
        setCurrentPage((prev) => (prev && prev.id === pageId ? { ...prev, title } : prev));
      }
      return await manuscriptService.docs.updateTitle(pageId, title, oldTitle);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      // Synchronize open tabs across projects
      const tabsState = useWorkspaceStore.getState();
      Object.keys(tabsState.tabsByProject).forEach((projId) => {
        tabsState.updateTabTitle(projId, variables.pageId, variables.title);
      });

      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success(`Renamed to "${variables.title}"`, { id: `rename-file-${variables.pageId}` });
    },
    onError: (err: unknown, variables) => {
      const msg = err instanceof Error ? err.message : 'Failed to rename file';
      toast.error(msg, { id: `rename-file-${variables.pageId}` });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await manuscriptService.docs.delete(pageId);
    },
    onSuccess: (_data, pageId) => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (parentPageId) {
        queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
        queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(parentPageId) });
      }
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success('File deleted', { id: `delete-file-${pageId}` });
    },
    onError: (err: unknown, pageId) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(msg, { id: `delete-file-${pageId}` });
    },
  });

  const restorePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await workspaceCoordinator.restoreFile(pageId);
    },
    onSuccess: (_, pageId) => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(pageId) });
      if (parentPageId) {
        queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
        queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(parentPageId) });
      }
    },
    onError: (err: unknown, pageId) => {
      const msg = err instanceof Error ? err.message : 'Failed to restore file';
      toast.error(msg, { id: `restore-file-${pageId}` });
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (isLocked) throw new Error('Document is locked');
      return await manuscriptService.docs.duplicate(pageId);
    },
    onSuccess: (_data, pageId) => {
      const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id;
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (parentPageId) {
        queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
      }
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success('File duplicated', { id: `duplicate-file-${pageId}` });
    },
    onError: (err: unknown, pageId) => {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate file';
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
