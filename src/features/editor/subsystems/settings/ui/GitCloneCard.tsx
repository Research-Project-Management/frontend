'use client';

/**
 * GitCloneCard.tsx
 *
 * Git clone URL and access token management card.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { pagesService } from '@/features/editor/sdk/pages.service';

export interface GitCloneCardProps {
  projectId: string;
  open: boolean;
}

export function GitCloneCard({
  projectId,
  open,
}: GitCloneCardProps) {
  const [copiedGitUrl, setCopiedGitUrl] = useState(false);
  const [gitToken, setGitToken] = useState<string | null>(null);
  const [gitTokensList, setGitTokensList] = useState<
    Array<{ id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null }>
  >([]);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [copiedGitToken, setCopiedGitToken] = useState(false);
  const [gitRepoInfo, setGitRepoInfo] = useState<{ cloneUrl?: string; branch?: string } | null>(null);
  const copyGitUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyGitTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyGitUrlTimerRef.current) clearTimeout(copyGitUrlTimerRef.current);
      if (copyGitTokenTimerRef.current) clearTimeout(copyGitTokenTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!projectId || !open) return;
    let cancelled = false;
    pagesService.git
      .getRepoInfo(projectId)
      .then((info) => {
        if (cancelled) return;
        if (info) {
          setGitRepoInfo(info);
          if (Array.isArray(info.tokens)) {
            setGitTokensList(info.tokens);
            return;
          }
        }
        return pagesService.git.listTokens().then((res) => {
          if (!cancelled && res && Array.isArray(res.tokens)) {
            setGitTokensList(res.tokens);
          }
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, open]);

  const gitCloneUrl =
    gitRepoInfo?.cloneUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/git/${projectId || 'project'}.git`
      : `https://git.flux.app/git/${projectId || 'project'}.git`);

  const handleCopyGitUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`git clone ${gitCloneUrl}`);
      setCopiedGitUrl(true);
      toast.success('Copied git clone command', { id: 'copy-git-url' });
      if (copyGitUrlTimerRef.current) clearTimeout(copyGitUrlTimerRef.current);
      copyGitUrlTimerRef.current = setTimeout(() => {
        copyGitUrlTimerRef.current = null;
        setCopiedGitUrl(false);
      }, 2000);
    }
  };

  const handleCreateGitToken = async () => {
    setIsCreatingToken(true);
    try {
      const res = await pagesService.git.createToken(`Token ${new Date().toLocaleDateString()}`);
      const rawToken =
        typeof res?.token === 'string'
          ? res.token
          : (res?.token as unknown as { token?: string })?.token || '';
      setGitToken(rawToken);
      toast.success('Git token created', { id: 'git-token-action' });
      const updated = await pagesService.git.listTokens().catch(() => null);
      if (updated && Array.isArray(updated.tokens)) {
        setGitTokensList(updated.tokens);
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to create token', {
        id: 'git-token-action',
      });
    } finally {
      setIsCreatingToken(false);
    }
  };

  const handleRevokeGitToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);
    try {
      await pagesService.git.revokeToken(tokenId);
      setGitTokensList((prev) => prev.filter((t) => t.id !== tokenId));
      toast.success('Git token revoked', { id: 'git-token-revoke' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to revoke token', {
        id: 'git-token-revoke',
      });
    } finally {
      setRevokingTokenId(null);
    }
  };

  const handleCopyGitToken = () => {
    if (gitToken && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(gitToken);
      setCopiedGitToken(true);
      toast.success('Copied token', { id: 'copy-git-token' });
      if (copyGitTokenTimerRef.current) clearTimeout(copyGitTokenTimerRef.current);
      copyGitTokenTimerRef.current = setTimeout(() => {
        copyGitTokenTimerRef.current = null;
        setCopiedGitToken(false);
      }, 2000);
    }
  };

  return (
    <div className="p-3.5 rounded-lg border border-border bg-card/40 space-y-2.5">
      <div className="flex items-center gap-2">
        <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-13 font-medium text-foreground">Git Clone URL</span>
        {gitRepoInfo?.branch && (
          <span className="text-11 font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {gitRepoInfo.branch}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1">
        <code className="text-11 font-mono text-muted-foreground truncate flex-1 select-all">
          git clone {gitCloneUrl}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyGitUrl}
          className="h-6 px-2 text-11 cursor-pointer"
        >
          {copiedGitUrl ? <Check className="size-3" /> : <Copy className="size-3" />}
          <span className="ml-1">{copiedGitUrl ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      <div className="pt-2 border-t border-border/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Access tokens</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateGitToken}
            disabled={isCreatingToken}
            className="h-7 px-2.5 text-xs cursor-pointer"
          >
            {isCreatingToken ? 'Generating...' : 'Generate token'}
          </Button>
        </div>

        {gitToken && (
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-md px-2.5 py-1">
            <code className="font-mono text-11 text-foreground truncate flex-1 select-all">
              {gitToken}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyGitToken}
              className="h-6 px-2 text-11 cursor-pointer"
            >
              {copiedGitToken ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
          </div>
        )}

        {gitTokensList.length > 0 && (
          <div className="space-y-1">
            {gitTokensList.slice(0, 3).map((tok) => (
              <div
                key={tok.id}
                className="flex items-center justify-between text-11 bg-background border border-border/60 rounded px-2.5 py-1"
              >
                <span className="truncate font-mono text-foreground">
                  {tok.label} ({tok.prefix}…)
                </span>
                <button
                  type="button"
                  disabled={revokingTokenId === tok.id}
                  onClick={() => handleRevokeGitToken(tok.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer ml-2 shrink-0"
                  aria-label={`Revoke ${tok.label}`}
                >
                  {revokingTokenId === tok.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
