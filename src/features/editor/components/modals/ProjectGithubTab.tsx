'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useIntegrations } from '@/features/integrations/hooks/use-integrations';
import { useGithubSync } from '../../hooks/use-github-sync';
import { GitHubIcon } from '@/shared/components/icons';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface ProjectGithubTabProps {
  projectId?: string;
  projectTitle?: string;
}

export function ProjectGithubTab({ projectId, projectTitle }: ProjectGithubTabProps) {
  const queryClient = useQueryClient();
  const { integrations, connect, isConnecting } = useIntegrations();

  const githubIntegration = integrations.find((i) => i.provider === 'github');
  const isGithubConnected =
    githubIntegration?.status === 'connected' && !githubIntegration.needsReconnect;

  // Local states
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [targetBranch, setTargetBranch] = useState<string>('main');
  const [commitMessage, setCommitMessage] = useState<string>('Update manuscript from Flux');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newRepoName, setNewRepoName] = useState<string>(
    (projectTitle || 'latex-manuscript')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-'),
  );
  const [newRepoPrivate, setNewRepoPrivate] = useState<boolean>(true);
  const [showChangeRepo, setShowChangeRepo] = useState<boolean>(false);

  const {
    linkData,
    isLoadingLink,
    refetchLink,
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
            className="gap-2 shrink-0"
          >
            {isConnecting && <RefreshCw className="size-3.5 animate-spin" />}
            <GitHubIcon className="size-4" />
            Connect GitHub
          </Button>
        </div>
      </div>
    );
  }

  const linkedRepo = linkData?.link;
  const isLinked = Boolean(linkedRepo && !showChangeRepo);

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
            {/* Push Card */}
            <div className="p-4 rounded-md border border-border bg-card flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Upload className="size-3.5 text-primary" />
                  <span>Push to GitHub</span>
                </div>
                <p className="text-11 text-muted-foreground mt-1">
                  Commit and push all current project files and figures to branch{' '}
                  <code className="text-foreground">{linkedRepo.branch || 'main'}</code>.
                </p>
                <div className="mt-2.5">
                  <Input
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => pushMutation.mutate({ commitMessage, branch: targetBranch })}
                disabled={pushMutation.isPending}
                className="gap-2 w-full h-8 text-xs cursor-pointer"
              >
                {pushMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <GitCommit className="size-3.5" />
                )}
                Push Changes
              </Button>
            </div>

            {/* Pull Card */}
            <div className="p-4 rounded-md border border-border bg-card flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Download className="size-3.5 text-emerald-500" />
                  <span>Pull from GitHub</span>
                </div>
                <p className="text-11 text-muted-foreground mt-1">
                  Pull latest files and figures from GitHub into this project. Local changes will be updated with remote commits.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to pull from GitHub? This will update project files with remote changes.',
                    )
                  ) {
                    pullMutation.mutate({ branch: targetBranch });
                  }
                }}
                disabled={pullMutation.isPending}
                className="gap-2 w-full h-8 text-xs cursor-pointer border-border"
              >
                {pullMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
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
            <div className="p-4 rounded-md border border-border bg-card space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">GitHub Repository</label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger className="w-full h-8 text-xs bg-background">
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
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Branch</label>
                <Input
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  placeholder="main"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {showChangeRepo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    linkMutation.mutate({
                      repoFullName: selectedRepo,
                      branch: targetBranch.trim() || 'main',
                    })
                  }
                  disabled={!selectedRepo || linkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  {linkMutation.isPending && <RefreshCw className="size-3.5 animate-spin" />}
                  Link Repository
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-md border border-border bg-card space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Repository Name</label>
                <Input
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="paper-manuscript"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-repo-check"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                  className="size-3.5 rounded border-border cursor-pointer accent-primary"
                />
                <label htmlFor="private-repo-check" className="text-xs text-foreground cursor-pointer">
                  Private repository (recommended)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {showChangeRepo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangeRepo(false)}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    createAndLinkMutation.mutate({
                      name: newRepoName.trim(),
                      isPrivate: newRepoPrivate,
                      defaultBranch: 'main',
                    })
                  }
                  disabled={!newRepoName.trim() || createAndLinkMutation.isPending}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  {createAndLinkMutation.isPending && <RefreshCw className="size-3.5 animate-spin" />}
                  <Plus className="size-3.5" />
                  Create & Link
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
