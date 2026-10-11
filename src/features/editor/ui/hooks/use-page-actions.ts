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
import { manuscriptService } from '@/features/editor/sdk';
import { workspaceCoordinator } from '../../coordinators/workspace.coordinator';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useTabsStore } from '@/features/editor/store/tabs.store';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { pageKeys } from './document.queries';
import { toast } from 'sonner';

export function usePageActions() {
  const isLocked = useSettingsStore((s) => s.isLocked);
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const queryClient = useQueryClient();

  const updateContentMutation = useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      if (isLocked) throw new Error('Document is locked');
      setCurrentPage((prev) => (prev ? { ...prev, content } : prev));
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
      setCurrentPage((prev) => (prev ? { ...prev, title } : prev));
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
      return await workspaceCoordinator.restoreFile(pageId);
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(pageId) });
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
