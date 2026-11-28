'use client';

/**
 * use-github-sync.ts
 *
 * Dedicated hook for manuscript GitHub integration & sync.
 * Encapsulates link, create & link, push, and pull mutations and notifications.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { integrationService } from '@/features/settings/services/integration.service';
import type { GitHubPageStatus } from '@/features/settings/types/integration.types';
import { pageKeys } from '@/features/editor/core/queries/document.queries';
import {
  resolveEditorScopeFromState,
  sessionCoordinator,
  getAllRegisteredEngines,
  usePageStore,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { flushYjsProviders } from '@/features/editor/sdk/realtime';

const githubSyncKeys = {
  link: (pageId?: string) => ['github-link', pageId] as const,
  repos: () => ['github-repos'] as const,
};

export interface UseGithubSyncOptions {
  pageId?: string;
  pageTitle?: string;
  enabled?: boolean;
  fetchRepos?: boolean;
  onLinkSuccess?: () => void;
  onCreateSuccess?: () => void;
}

export function useGithubSync({
  pageId,
  pageTitle,
  enabled = true,
  fetchRepos = false,
  onLinkSuccess,
  onCreateSuccess,
}: UseGithubSyncOptions = {}) {
  const queryClient = useQueryClient();
  const storeRootPageId = usePageStore(
    (s) => resolveEditorScopeFromState(s, { pageId }).rootPageId,
  );
  const storeGithubLink = usePageStore((s) => s.githubLink);
  const effectivePageId = pageId?.trim() || storeRootPageId || undefined;

  const linkQuery = useQuery({
    queryKey: githubSyncKeys.link(effectivePageId),
    queryFn: () =>
      effectivePageId ? integrationService.getPageGithubLink(effectivePageId) : null,
    enabled: Boolean(effectivePageId) && enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!linkQuery.data) return;
    const remoteLink = linkQuery.data.link;
    usePageStore.getState().setGithubLink(
      remoteLink
        ? {
            id: remoteLink.id,
            repoFullName: remoteLink.repoFullName,
            branch: remoteLink.branch,
            lastSyncedAt: remoteLink.lastSyncedAt ?? null,
          }
        : null,
    );
  }, [linkQuery.data]);

  const reposQuery = useQuery({
    queryKey: githubSyncKeys.repos(),
    queryFn: () => integrationService.listGithubRepos(),
    enabled: Boolean(enabled && fetchRepos),
    retry: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: { repoFullName: string; branch: string }) => {
      if (!effectivePageId) throw new Error('Page ID is required');
      return await integrationService.linkPageGithub({
        pageId: effectivePageId,
        repoFullName: payload.repoFullName,
        branch: payload.branch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Linked to ${data.repoFullName}`, { id: 'github-link' });
      usePageStore.getState().setGithubLink({
        id: data.linkId,
        repoFullName: data.repoFullName,
        branch: data.branch,
        lastSyncedAt: null,
      });
      void linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(effectivePageId) });
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
      if (!effectivePageId) throw new Error('Page ID is required');
      const created = await integrationService.createGithubRepo({
        name,
        private: isPrivate,
        description: `LaTeX manuscript: ${pageTitle || 'Manuscript'}`,
      });
      return await integrationService.linkPageGithub({
        pageId: effectivePageId,
        repoFullName: created.fullName,
        branch: created.defaultBranch || defaultBranch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Created & linked ${data.repoFullName}`, { id: 'github-create-link' });
      usePageStore.getState().setGithubLink({
        id: data.linkId,
        repoFullName: data.repoFullName,
        branch: data.branch,
        lastSyncedAt: null,
      });
      void linkQuery.refetch();
      queryClient.invalidateQueries({ queryKey: githubSyncKeys.link(effectivePageId) });
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
      if (!effectivePageId) throw new Error('Page ID is required');
      const engines = getAllRegisteredEngines?.();
      if (engines) {
        for (const [fId, eng] of engines.entries()) {
          const liveContent = eng?.getContent?.();
          if (fId && typeof liveContent === 'string') {
            const model = lruDocumentCache.getModel(fId);
            if (model && model.content !== liveContent) {
              lruDocumentCache.updateContent(fId, liveContent, true);
            }
          }
        }
      }
      flushYjsProviders(effectivePageId);
      await sessionCoordinator.flushAllPending();
      return await integrationService.pushPageGithub({
        pageId: effectivePageId,
        commitMessage: commitMessage?.trim() || 'Update manuscript from Flux',
        branch,
      });
    },
    onSuccess: (data) => {
      toast.success(`Pushed ${data.fileCount} files (${data.commitSha.slice(0, 7)})`, { id: 'github-push' });
      const prev = usePageStore.getState().githubLink;
      if (prev) {
        usePageStore.getState().setGithubLink({
          ...prev,
          branch: data.branch || prev.branch,
          lastSyncedAt: data.syncedAt || new Date().toISOString(),
        });
      }
      void linkQuery.refetch();
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to push to GitHub', { id: 'github-push' });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async ({ branch }: { branch: string }) => {
      if (!effectivePageId) throw new Error('Page ID is required');
      return await integrationService.pullPageGithub({
        pageId: effectivePageId,
        branch,
      });
    },
    onSuccess: async (data) => {
      toast.success(`Pulled ${data.filesImported} files from GitHub`, { id: 'github-pull' });
      const prev = usePageStore.getState().githubLink;
      if (prev) {
        usePageStore.getState().setGithubLink({
          ...prev,
          branch: data.branch || prev.branch,
          lastSyncedAt: data.syncedAt || new Date().toISOString(),
        });
      }
      void linkQuery.refetch();
      sessionCoordinator.resetForExternalTreeSync(effectivePageId);
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to pull from GitHub', { id: 'github-pull' });
    },
  });

  const fallbackLinkData: GitHubPageStatus | undefined = storeGithubLink
    ? {
        isConnected: enabled,
        link: storeGithubLink,
      }
    : undefined;

  return {
    linkData: linkQuery.data ?? fallbackLinkData,
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
