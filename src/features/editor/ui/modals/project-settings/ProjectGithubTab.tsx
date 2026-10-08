'use client';

/**
 * ProjectGithubTab.tsx
 *
 * Canonical Project Settings - GitHub Integration & Two-Way Sync Tab (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/ProjectGithubTab.tsx`
 */

import React, { useState } from 'react';
import {
  GitBranch,
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
import { useGithubSync } from '@/features/editor/ui/hooks/use-github-sync';
import { GitHubIcon } from '@/shared/components/icons';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
} from '@/features/editor/domain/types';

interface ProjectGithubTabProps {
  projectId?: string;
  projectTitle?: string;
}

export function ProjectGithubTab({ projectId, projectTitle }: ProjectGithubTabProps) {
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
    projectId,
    projectTitle,
    onLinkSuccess: () => setShowChangeRepo(false),
    onCreateSuccess: () => setIsCreatingNew(false),
  });

  const linkedRepo = linkData?.link;
  const isLinked = Boolean(linkedRepo && !showChangeRepo);

  // Push form (react-hook-form + zod)
  const {
    register: registerPush,
    handleSubmit: handleSubmitPush,
    formState: { errors: pushErrors },
  } = useForm<PushChangesFormValues>({
    resolver: zodResolver(pushChangesSchema),
    defaultValues: {
      commitMessage: 'Update manuscript from Flux',
      targetBranch: linkedRepo?.branch || 'main',
    },
  });

  // Link existing repo form (react-hook-form + zod)
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

  // Create & link new repo form (react-hook-form + zod)
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    watch: watchCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors },
  } = useForm<CreateRepoFormValues>({
    resolver: zodResolver(createRepoSchema),
    defaultValues: {
      newRepoName: (projectTitle || 'latex-manuscript')
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
      <div className="space-y-6">
        <div className="p-4 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-muted/60 p-2 shrink-0 flex items-center justify-center">
              <GitHubIcon className="size-6 text-foreground" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Connect GitHub</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Link this project to a repository for Git version control and two-way synchronization.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => connect('github')}
            disabled={isConnecting}
            className="gap-2 shrink-0 cursor-pointer"
          >
            {isConnecting && <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />}
            <GitHubIcon className="size-4" />
            Connect GitHub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Info Header */}
      <div className="p-3.5 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
        <GitBranch className="size-4 text-primary shrink-0 mt-0.5" />
        <div>
          Synchronize this project with GitHub. Commits are tracked in the remote repository tree, allowing seamless collaboration across Overleaf, Git, and Flux.
        </div>
      </div>

      {/* ── Linked State ──────────────────────────────────────────────────────── */}
      {isLinked && linkedRepo && (
        <div className="space-y-4">
          {/* Linked Repo Card */}
          <div className="p-4 rounded-md border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-md bg-muted/50 p-2 shrink-0 flex items-center justify-center">
                <GitHubIcon className="size-5 text-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://github.com/${linkedRepo.repoFullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate"
                  >
                    <span>{linkedRepo.repoFullName}</span>
                    <ExternalLink className="size-3 text-current shrink-0" />
                  </a>
                  <Badge
                    variant="outline"
                    className="font-mono text-10 px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                  >
                    {linkedRepo.branch || 'main'}
                  </Badge>
                </div>
                <p className="text-11 text-muted-foreground mt-0.5">
                  {linkedRepo.lastSyncedAt
                    ? `Last synced: ${new Date(linkedRepo.lastSyncedAt).toLocaleString()}`
                    : 'Not synced yet'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangeRepo(true)}
              className="text-xs h-7 px-2.5 cursor-pointer shrink-0"
            >
              Change Repository
            </Button>
          </div>

          {/* Action Grid: Push & Pull */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Push Card Form */}
            <form
              onSubmit={handleSubmitPush(onPushSubmit)}
              className="p-4 rounded-md border border-border bg-card flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Upload className="size-3.5 text-primary" />
                  <span>Push to GitHub</span>
                </div>
                <p className="text-11 text-muted-foreground mt-1">
                  Commit and push all current project files and figures to branch{' '}
                  <code className="text-foreground">{linkedRepo.branch || 'main'}</code>.
                </p>
                <div className="mt-2.5 space-y-1">
                  <Input
                    {...registerPush('commitMessage')}
                    placeholder="Commit message..."
                    className="h-8 text-xs bg-background"
                  />
                  {pushErrors.commitMessage && (
                    <p className="text-10 text-destructive">{pushErrors.commitMessage.message}</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={pushMutation.isPending}
                className="gap-2 w-full h-8 text-xs cursor-pointer"
              >
                {pushMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <GitCommit className="size-3.5" />
                )}
                Push Changes
              </Button>
            </form>

            {/* Pull Card */}
            <div className="p-4 rounded-md border border-border bg-card flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Download className="size-3.5 text-primary" />
                  <span>Pull from GitHub</span>
                </div>
                <p className="text-11 text-muted-foreground mt-1">
                  Pull latest files and figures from GitHub into this project. Local changes will be updated with remote commits.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPullConfirmOpen(true)}
                disabled={pullMutation.isPending}
                className="gap-2 w-full h-8 text-xs cursor-pointer border-border motion-reduce:transition-none"
              >
                {pullMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <GitPullRequest className="size-3.5" />
                )}
                Pull Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlinked State / Change Repository ────────────────────────────────── */}
      {(!isLinked || showChangeRepo) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">
              {isCreatingNew ? 'Create New GitHub Repository' : 'Link an Existing Repository'}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-xs h-7 px-2 text-primary cursor-pointer"
            >
              {isCreatingNew ? 'Select Existing Repository' : 'Create New Repository Instead'}
            </Button>
          </div>

          {!isCreatingNew ? (
            <form
              onSubmit={handleSubmitLink(onLinkSubmit)}
              className="p-4 rounded-md border border-border bg-card space-y-3.5"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">GitHub Repository</label>
                <Select
                  value={selectedRepo}
                  onValueChange={(val) => setLinkValue('selectedRepo', val, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Select GitHub repository" className="w-full h-8 text-xs bg-background">
                    <SelectValue placeholder={isLoadingRepos ? 'Loading repositories...' : 'Choose a repository'} />
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
                  <p className="text-10 text-destructive">{linkErrors.selectedRepo.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Branch</label>
                <Input
                  {...registerLink('targetBranch')}
                  aria-label="Target Branch"
                  placeholder="main"
                  className="h-8 text-xs bg-background"
                />
                {linkErrors.targetBranch && (
                  <p className="text-10 text-destructive">{linkErrors.targetBranch.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {showChangeRepo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer motion-reduce:transition-none"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedRepo || linkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer motion-reduce:transition-none"
                >
                  {linkMutation.isPending && <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />}
                  Link Repository
                </Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleSubmitCreate(onCreateSubmit)}
              className="p-4 rounded-md border border-border bg-card space-y-3.5"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Repository Name</label>
                <Input
                  {...registerCreate('newRepoName')}
                  aria-label="New Repository Name"
                  placeholder="paper-manuscript"
                  className="h-8 text-xs bg-background"
                />
                {createErrors.newRepoName && (
                  <p className="text-10 text-destructive">{createErrors.newRepoName.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="private-repo-check"
                  checked={newRepoPrivate}
                  onCheckedChange={(checked) => setCreateValue('newRepoPrivate', Boolean(checked))}
                />
                <label htmlFor="private-repo-check" className="text-xs text-foreground cursor-pointer select-none">
                  Private repository (recommended)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {showChangeRepo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer motion-reduce:transition-none"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={createAndLinkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer motion-reduce:transition-none"
                >
                  {createAndLinkMutation.isPending && <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />}
                  <Plus className="size-3.5" />
                  Create & Link
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Pull Confirmation Dialog */}
      <AlertDialog open={isPullConfirmOpen} onOpenChange={setIsPullConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Pull changes from GitHub?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will update your project files with remote commits from branch{' '}
              <code className="text-foreground font-mono">{linkedRepo?.branch || 'main'}</code>.
              Make sure your work is saved before pulling.
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
              Pull Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProjectGithubTab;
