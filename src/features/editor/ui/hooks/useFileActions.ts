'use client';

/**
 * useFileActions.ts
 *
 * File Hierarchy & Configuration Mutation Hook:
 * - Creating child files
 * - Setting root/main manuscript file
 *
 * Layer 4: Presentation / UI Hooks.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '@/features/editor/sdk/manuscript.service';
import { workspaceCoordinator, useSettingsStore, editorCommandBus } from '@/features/editor/core';
import { pageKeys } from './document.queries';
import { toast } from 'sonner';

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
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated', payload: { action: 'create', file: newFile } });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
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

  return {
    createFile: createFileMutation,
    setMainFile: setMainFileMutation,
  };
}
