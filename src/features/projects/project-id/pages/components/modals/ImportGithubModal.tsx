'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitBranch,
  FolderGit2,
  Search,
  Loader2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { githubImportService, GitHubRepoItem } from '../../services/github-import.service';
import { pageKeys } from '../../hooks/use-page';

interface ImportGithubModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: string;
}

export function ImportGithubModal({
  isOpen,
  setIsOpen,
  projectId,
}: ImportGithubModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 1. Fetch connection status
  const {
    data: status,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['github-integration-status'],
    queryFn: () => githubImportService.getStatus(),
    enabled: isOpen,
    staleTime: 10_000,
  });

  const isConnected = Boolean(status?.github?.connected);
  const accountName = status?.github?.accountName;

  // 2. Fetch repos if connected
  const {
    data: repos = [],
    isLoading: isReposLoading,
    refetch: refetchRepos,
  } = useQuery<GitHubRepoItem[]>({
    queryKey: ['github-repos'],
    queryFn: () => githubImportService.listRepos(),
    enabled: isOpen && isConnected,
    staleTime: 60_000,
  });

  // 3. Fetch branches when repo is selected
  const { data: branches = [], isLoading: isBranchesLoading } = useQuery<string[]>({
    queryKey: ['github-branches', selectedRepo],
    queryFn: () => (selectedRepo ? githubImportService.listBranches(selectedRepo) : []),
    enabled: isOpen && Boolean(selectedRepo),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (branches.length > 0) {
      if (branches.includes('main')) setSelectedBranch('main');
      else if (branches.includes('master')) setSelectedBranch('master');
      else setSelectedBranch(branches[0]);
    }
  }, [branches]);

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const q = searchQuery.toLowerCase().trim();
    return repos.filter((r) => r.name.toLowerCase().includes(q));
  }, [repos, searchQuery]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { authUrl } = await githubImportService.getAuthUrl();
      const popup = window.open(
        authUrl,
        'github-oauth',
        'width=600,height=750,menubar=no,toolbar=no',
      );

      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setIsConnecting(false);
          refetchStatus();
          refetchRepos();
        }
      }, 1000);
    } catch (err) {
      setIsConnecting(false);
      toast.error('Failed to initiate GitHub OAuth authorization.');
    }
  };

  const handleImport = async () => {
    if (!selectedRepo || !projectId) return;

    setIsImporting(true);
    const toastId = toast.loading(`Cloning and importing ${selectedRepo} on branch ${selectedBranch}...`);

    try {
      const result = await githubImportService.importRepo({
        projectId,
        repoFullName: selectedRepo,
        branch: selectedBranch,
      });

      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success(`Repository ${selectedRepo} imported successfully`, { id: toastId });
      setIsOpen(false);
      setSelectedRepo(null);

      if (result?.rootDocId) {
        router.push(`/projects/${projectId}/pages/${result.rootDocId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'GitHub import failed', { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[540px] p-6 bg-background border border-border/80 shadow-raised-200 rounded-md gap-4">
        <DialogHeader>
          <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
            Import GitHub Repository
          </DialogTitle>
          <DialogDescription className="sr-only">
            Select and import a GitHub repository into this project.
          </DialogDescription>
        </DialogHeader>

        {/* Body content based on connection status */}
        {isStatusLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
            <span className="text-12">Checking GitHub connection...</span>
          </div>
        ) : !isConnected ? (
          <div className="border border-border/80 rounded-lg p-6 flex flex-col items-center justify-center text-center gap-3 bg-muted/10 my-2">
            <div className="size-11 rounded-full bg-muted/60 flex items-center justify-center text-foreground">
              <FolderGit2 className="size-5" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-12 font-semibold text-foreground">Connect your GitHub Account</h4>
              <p className="text-11 text-muted-foreground leading-relaxed">
                Connect your GitHub profile to access your public and private academic repositories for instant cloning.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isConnecting}
              onClick={handleConnect}
              className="h-8 text-12 font-medium px-4 cursor-pointer gap-2 mt-1 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              {isConnecting ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <ExternalLink className="size-3.5" />}
              <span>{isConnecting ? 'Waiting for authorization...' : 'Connect GitHub'}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 my-2">
            {/* Account Status bar */}
            <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/60 text-12">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="size-3.5 text-success" />
                <span>Connected as <strong className="font-semibold">@{accountName}</strong></span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetchRepos()}
                className="h-6 px-2 text-11 text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <RefreshCw className="size-3 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Repository search and list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-12 font-medium text-foreground">
                <span>Select Repository</span>
                <span className="text-11 text-muted-foreground">{filteredRepos.length} repositories</span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-13 bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="h-44 border border-border rounded-md overflow-y-auto divide-y divide-border/60 bg-muted/5">
                {isReposLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    <span className="text-12">Loading repositories...</span>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-12 text-muted-foreground">
                    No repositories found
                  </div>
                ) : (
                  filteredRepos.map((repo) => {
                    const isSelected = selectedRepo === repo.name;
                    return (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => setSelectedRepo(repo.name)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-12 flex items-center justify-between transition-colors cursor-pointer relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                          isSelected
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'hover:bg-muted/50 text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FolderGit2 className="size-3.5 shrink-0" />
                          <span className="truncate">{repo.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="size-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Branch Selector */}
            {selectedRepo && (
              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <label className="text-12 font-medium text-foreground flex items-center gap-1.5">
                  <GitBranch className="size-3.5" />
                  <span>Target Branch</span>
                </label>
                {isBranchesLoading ? (
                  <div className="flex items-center gap-2 text-12 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                    <span>Loading branches...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {branches.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBranch(b)}
                        className={cn(
                          'px-2.5 py-1 rounded-sm text-12 font-mono transition-colors cursor-pointer border relative before:absolute before:-inset-1.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                          selectedBranch === b
                            ? 'bg-foreground text-background border-foreground font-medium'
                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isConnected || !selectedRepo || isImporting}
            onClick={handleImport}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isImporting ? 'Importing...' : 'Import Repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportGithubModal;
