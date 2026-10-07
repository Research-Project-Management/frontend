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

export const githubSyncKeys = {
  all: ['github-sync'] as const,
  link: (projectId?: string) => ['github-link', projectId] as const,
  repos: () => ['github-repos'] as const,
};

export interface UseGithubSyncOptions {
  projectId?: string;
  projectTitle?: string;
  onLinkSuccess?: () => void;
  onCreateSuccess?: () => void;
}

export function useGithubSync({
  projectId,
  projectTitle,
  onLinkSuccess,
  onCreateSuccess,
}: UseGithubSyncOptions = {}) {
  const queryClient = useQueryClient();

  const linkQuery = useQuery({
    queryKey: githubSyncKeys.link(projectId),
    queryFn: () => (projectId ? integrationService.getProjectGithubLink(projectId) : null),
    enabled: Boolean(projectId),
  });

  const reposQuery = useQuery({
    queryKey: githubSyncKeys.repos(),
    queryFn: () => integrationService.listGithubRepos(),
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
      toast.success(`Successfully linked project to ${data.repoFullName}`);
      linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(projectId) });
      onLinkSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to link GitHub repository');
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
      toast.success(`Created & linked repository ${data.repoFullName}!`);
      linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(projectId) });
      onCreateSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create GitHub repository');
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
      return await integrationService.pushProjectGithub({
        projectId,
        commitMessage: commitMessage?.trim() || 'Update manuscript from Flux',
        branch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Pushed ${data.fileCount} files to GitHub (${data.commitSha.slice(0, 7)})!`);
      linkQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to push to GitHub');
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
    onSuccess: (data) => {
      toast.success(`Pulled ${data.filesImported} files from GitHub!`);
      linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      queryClient.invalidateQueries({ queryKey: ['manuscript-nodes', projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to pull from GitHub');
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
