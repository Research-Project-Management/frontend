'use client';

/**
 * GithubTab.tsx
 *
 * GitHub repository sync tab inside SettingsModal.
 */

import React, { useEffect, useState } from 'react';
import {
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Upload,
  Download,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntegrations } from '@/features/settings/hooks/use-integrations';
import { useGithubSync } from '../hooks/useGithubSync';
import { GitHubIcon } from '@/shared/components/icons/IntegrationIcons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  pushChangesSchema,
  linkRepoSchema,
  createRepoSchema,
  type PushChangesFormValues,
  type LinkRepoFormValues,
  type CreateRepoFormValues,
} from '@/features/editor/domain/types/core.types';

interface GithubTabProps {
  pageId?: string;
  pageTitle?: string;
}

export function GithubTab({ pageId, pageTitle }: GithubTabProps) {
  const { integrations, connect, isConnecting } = useIntegrations();

  const githubIntegration = integrations.find((i) => i.provider === 'github');
  const isGithubConnected =
    githubIntegration?.status === 'connected' && !githubIntegration.needsReconnect;

  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [showChangeRepo, setShowChangeRepo] = useState<boolean>(false);
  const [isPullConfirmOpen, setIsPullConfirmOpen] = useState<boolean>(false);

  const {
    linkData,
    repos: userRepos,
    isLoadingRepos,
    linkMutation,
    createAndLinkMutation,
    pushMutation,
    pullMutation,
  } = useGithubSync({
    pageId,
    pageTitle,
    enabled: isGithubConnected,
    fetchRepos: isGithubConnected,
    onLinkSuccess: () => setShowChangeRepo(false),
    onCreateSuccess: () => setIsCreatingNew(false),
  });

  const linkedRepo = linkData?.link;
  const isLinked = Boolean(linkedRepo && !showChangeRepo);

  const {
    register: registerPush,
    handleSubmit: handleSubmitPush,
    setValue: setPushValue,
    formState: { errors: pushErrors },
  } = useForm<PushChangesFormValues>({
    resolver: zodResolver(pushChangesSchema),
    defaultValues: {
      commitMessage: 'Update manuscript from Flux',
      targetBranch: linkedRepo?.branch || 'main',
    },
  });

  useEffect(() => {
    if (linkedRepo?.branch) {
      setPushValue('targetBranch', linkedRepo.branch);
    }
  }, [linkedRepo?.branch, setPushValue]);

  const {
    register: registerLink,
    handleSubmit: handleSubmitLink,
    setValue: setLinkValue,
    watch: watchLink,
    formState: { errors: linkErrors },
  } = useForm<LinkRepoFormValues>({
    resolver: zodResolver(linkRepoSchema),
    defaultValues: {
      selectedRepo: '',
      targetBranch: 'main',
    },
  });

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    watch: watchCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors },
  } = useForm<CreateRepoFormValues>({
    resolver: zodResolver(createRepoSchema),
    defaultValues: {
      newRepoName: (pageTitle || 'latex-manuscript')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-'),
      newRepoPrivate: true,
    },
  });

  const selectedRepo = watchLink('selectedRepo');
  const newRepoPrivate = watchCreate('newRepoPrivate');

  const onPushSubmit = (data: PushChangesFormValues) => {
    pushMutation.mutate({
      commitMessage: data.commitMessage,
      branch: data.targetBranch || linkedRepo?.branch || 'main',
    });
  };

  const onLinkSubmit = (data: LinkRepoFormValues) => {
    linkMutation.mutate({
      repoFullName: data.selectedRepo,
      branch: data.targetBranch.trim() || 'main',
    });
  };

  const onCreateSubmit = (data: CreateRepoFormValues) => {
    createAndLinkMutation.mutate({
      name: data.newRepoName.trim(),
      isPrivate: data.newRepoPrivate,
      defaultBranch: 'main',
    });
  };

  if (!isGithubConnected) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <GitHubIcon className="size-5 text-foreground" />
          </div>
          <div>
            <h4 className="text-13 font-medium text-foreground">GitHub</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect a repository to push and pull changes.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => connect('github')}
          disabled={isConnecting}
          className="h-8 text-xs gap-1.5 shrink-0 cursor-pointer"
        >
          {isConnecting && <RefreshCw className="size-3.5 animate-spin" />}
          Connect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <GitHubIcon className="size-3.5 text-foreground shrink-0" />
          <span className="truncate">
            {githubIntegration?.accountName || 'GitHub connected'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => connect('github')}
          disabled={isConnecting}
          className="h-7 text-xs px-2.5 shrink-0 cursor-pointer"
        >
          {isConnecting && <RefreshCw className="size-3 animate-spin mr-1.5" />}
          Reconnect
        </Button>
      </div>

      {isLinked && linkedRepo && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-lg border border-border bg-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <a
                  href={`https://github.com/${linkedRepo.repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-13 font-medium text-foreground hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{linkedRepo.repoFullName}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
                <span className="font-mono text-11 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {linkedRepo.branch || 'main'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {linkedRepo.lastSyncedAt
                  ? `Last synced ${new Date(linkedRepo.lastSyncedAt).toLocaleString()}`
                  : 'Not synced yet'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangeRepo(true)}
              className="text-xs h-7 px-2.5 cursor-pointer shrink-0"
            >
              Change
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <form
              onSubmit={handleSubmitPush(onPushSubmit)}
              className="p-3.5 rounded-lg border border-border bg-card/40 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-13 font-medium text-foreground">
                  <Upload className="size-3.5" />
                  <span>Push</span>
                </div>
                <Input
                  {...registerPush('commitMessage')}
                  aria-label="Commit message"
                  placeholder="Commit message..."
                  className="h-8 text-xs bg-background"
                />
                {pushErrors.commitMessage && (
                  <p className="text-11 text-destructive">{pushErrors.commitMessage.message}</p>
                )}
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={pushMutation.isPending}
                className="gap-1.5 w-full h-8 text-xs cursor-pointer"
              >
                {pushMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <GitCommit className="size-3.5" />
                )}
                Push changes
              </Button>
            </form>

            <div className="p-3.5 rounded-lg border border-border bg-card/40 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-13 font-medium text-foreground">
                  <Download className="size-3.5" />
                  <span>Pull</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Fetch latest commits from{' '}
                  <code className="text-foreground">{linkedRepo.branch || 'main'}</code>.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPullConfirmOpen(true)}
                disabled={pullMutation.isPending}
                className="gap-1.5 w-full h-8 text-xs cursor-pointer border-border"
              >
                {pullMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <GitPullRequest className="size-3.5" />
                )}
                Pull changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {(!isLinked || showChangeRepo) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-13 font-medium text-foreground">
              {isCreatingNew ? 'New repository' : 'Link repository'}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isCreatingNew ? 'Use existing' : 'Create new'}
            </Button>
          </div>

          {!isCreatingNew ? (
            <form
              onSubmit={handleSubmitLink(onLinkSubmit)}
              className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Repository</label>
                <Select
                  value={selectedRepo}
                  onValueChange={(val) =>
                    setLinkValue('selectedRepo', val, { shouldValidate: true })
                  }
                >
                  <SelectTrigger
                    aria-label="Select GitHub repository"
                    className="w-full h-8 text-xs bg-background"
                  >
                    <SelectValue
                      placeholder={isLoadingRepos ? 'Loading...' : 'Select repository'}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {userRepos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id} className="text-xs cursor-pointer">
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {linkErrors.selectedRepo && (
                  <p className="text-11 text-destructive">{linkErrors.selectedRepo.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Branch</label>
                <Input
                  {...registerLink('targetBranch')}
                  aria-label="Target Branch"
                  placeholder="main"
                  className="h-8 text-xs bg-background"
                />
                {linkErrors.targetBranch && (
                  <p className="text-11 text-destructive">{linkErrors.targetBranch.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                {showChangeRepo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedRepo || linkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  {linkMutation.isPending && <RefreshCw className="size-3.5 animate-spin" />}
                  Link
                </Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleSubmitCreate(onCreateSubmit)}
              className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Name</label>
                <Input
                  {...registerCreate('newRepoName')}
                  aria-label="New Repository Name"
                  placeholder="paper-manuscript"
                  className="h-8 text-xs bg-background"
                />
                {createErrors.newRepoName && (
                  <p className="text-11 text-destructive">
                    {createErrors.newRepoName.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="private-repo-check"
                  checked={newRepoPrivate}
                  onCheckedChange={(checked) => setCreateValue('newRepoPrivate', Boolean(checked))}
                />
                <label
                  htmlFor="private-repo-check"
                  className="text-xs text-foreground cursor-pointer select-none"
                >
                  Private repository
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                {showChangeRepo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={createAndLinkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  {createAndLinkMutation.isPending && (
                    <RefreshCw className="size-3.5 animate-spin" />
                  )}
                  <Plus className="size-3.5" />
                  Create & link
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {isPullConfirmOpen && (
        <AlertDialog open={isPullConfirmOpen} onOpenChange={setIsPullConfirmOpen}>
          <AlertDialogContent className="w-[95vw] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Pull from GitHub?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Local files will be updated with commits from{' '}
                <code className="text-foreground font-mono">{linkedRepo?.branch || 'main'}</code>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="h-8 text-xs"
                onClick={() => {
                  setIsPullConfirmOpen(false);
                  pullMutation.mutate({ branch: linkedRepo?.branch || 'main' });
                }}
              >
                Pull
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export default GithubTab;
