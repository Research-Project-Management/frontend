'use client';

/**
 * use-github-sync.ts
 *
 * Dedicated hook for manuscript GitHub integration & sync.
 * Encapsulates link, create & link, push, and pull mutations and notifications.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { integrationService } from '@/features/settings/services/integration.service';
import { pageKeys } from '@/features/editor/ui/hooks/document.queries';
import { editorCommandBus, sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer';
import { clearYjsProviderPool, flushYjsProviders } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';

export const githubSyncKeys = {
  all: ['github-sync'] as const,
  link: (projectId?: string) => ['github-link', projectId] as const,
  repos: () => ['github-repos'] as const,
};

export interface UseGithubSyncOptions {
  projectId?: string;
  projectTitle?: string;
  enabled?: boolean;
  onLinkSuccess?: () => void;
  onCreateSuccess?: () => void;
}

export function useGithubSync({
  projectId,
  projectTitle,
  enabled = true,
  onLinkSuccess,
  onCreateSuccess,
}: UseGithubSyncOptions = {}) {
  const queryClient = useQueryClient();

  const linkQuery = useQuery({
    queryKey: githubSyncKeys.link(projectId),
    queryFn: () => (projectId ? integrationService.getProjectGithubLink(projectId) : null),
    enabled: Boolean(projectId) && enabled,
  });

  const reposQuery = useQuery({
    queryKey: githubSyncKeys.repos(),
    queryFn: () => integrationService.listGithubRepos(),
    enabled,
    retry: false,
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: { repoFullName: string; branch: string }) => {
      if (!projectId) throw new Error('Project ID is required');
      return await integrationService.linkProjectGithub({
        projectId,
        repoFullName: payload.repoFullName,
        branch: payload.branch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Successfully linked project to ${data.repoFullName}`, { id: 'github-link' });
      linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(projectId) });
      onLinkSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to link GitHub repository', { id: 'github-link' });
    },
  });

  const createAndLinkMutation = useMutation({
    mutationFn: async ({
      name,
      isPrivate,
      defaultBranch = 'main',
    }: {
      name: string;
      isPrivate: boolean;
      defaultBranch?: string;
    }) => {
      if (!projectId) throw new Error('Project ID is required');
      const created = await integrationService.createGithubRepo({
        name,
        private: isPrivate,
        description: `LaTeX manuscript: ${projectTitle || 'Research Project'}`,
      });
      return await integrationService.linkProjectGithub({
        projectId,
        repoFullName: created.fullName,
        branch: created.defaultBranch || defaultBranch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Created & linked repository ${data.repoFullName}!`, { id: 'github-create-link' });
      linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(projectId) });
      onCreateSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to create GitHub repository', { id: 'github-create-link' });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async ({
      commitMessage,
      branch,
    }: {
      commitMessage?: string;
      branch: string;
    }) => {
      if (!projectId) throw new Error('Project ID is required');
      flushYjsProviders(projectId);
      await sessionCoordinator.flushAllPending();
      return await integrationService.pushProjectGithub({
        projectId,
        commitMessage: commitMessage?.trim() || 'Update manuscript from Flux',
        branch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Pushed ${data.fileCount} files to GitHub (${data.commitSha.slice(0, 7)})!`, { id: 'github-push' });
      linkQuery.refetch();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to push to GitHub', { id: 'github-push' });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async ({ branch }: { branch: string }) => {
      if (!projectId) throw new Error('Project ID is required');
      return await integrationService.pullProjectGithub({
        projectId,
        branch,
      });
    },
    onSuccess: async (data) => {
      toast.success(`Pulled ${data.filesImported} files from GitHub!`, { id: 'github-pull' });
      linkQuery.refetch();
      lruDocumentCache.discardAll();
      clearYjsProviderPool();
      if (projectId) {
        await draftStorageService.clearProjectDrafts(projectId);
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to pull from GitHub', { id: 'github-pull' });
    },
  });

  return {
    linkData: linkQuery.data,
    isLoadingLink: linkQuery.isLoading,
    refetchLink: linkQuery.refetch,
    repos: reposQuery.data || [],
    isLoadingRepos: reposQuery.isLoading,
    linkMutation,
    createAndLinkMutation,
    pushMutation,
    pullMutation,
  };
}
