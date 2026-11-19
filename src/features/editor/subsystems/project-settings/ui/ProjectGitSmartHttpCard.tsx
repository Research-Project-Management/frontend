/**
 * ProjectGitSmartHttpCard.tsx
 *
 * Git Clone URL & Smart-HTTP Personal Access Token card inside ProjectSettingsModal.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { pagesService } from '@/features/editor/sdk/pages.service';

export interface ProjectGitSmartHttpCardProps {
  projectId: string;
  open: boolean;
}

export function ProjectGitSmartHttpCard({
  projectId,
  open,
}: ProjectGitSmartHttpCardProps) {
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
      toast.success('Git clone command copied to clipboard!', { id: 'copy-git-url' });
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
      toast.success('Git Access Token generated successfully!', { id: 'git-token-action' });
      const updated = await pagesService.git.listTokens().catch(() => null);
      if (updated && Array.isArray(updated.tokens)) {
        setGitTokensList(updated.tokens);
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate Git Token', {
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
      toast.success('Git Access Token revoked', { id: 'git-token-revoke' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to revoke Git Token', {
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
      toast.success('Git Token copied to clipboard!', { id: 'copy-git-token' });
      if (copyGitTokenTimerRef.current) clearTimeout(copyGitTokenTimerRef.current);
      copyGitTokenTimerRef.current = setTimeout(() => {
        copyGitTokenTimerRef.current = null;
        setCopiedGitToken(false);
      }, 2000);
    }
  };

  return (
    <div className="p-2.5 rounded-md border border-border bg-card/40 space-y-2">
      <div className="flex items-center gap-2">
        <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground">Git Clone URL</span>
        {gitRepoInfo?.branch && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {gitRepoInfo.branch}
          </span>
        )}
        <span className="text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-sm ml-auto">
          Smart-HTTP
        </span>
      </div>
      <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1">
        <code className="text-[11px] font-mono text-muted-foreground truncate flex-1 select-all">
          git clone {gitCloneUrl}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyGitUrl}
          className="h-6 min-h-[26px] px-2 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
        >
          {copiedGitUrl ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          <span className="ml-1">{copiedGitUrl ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
      <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground space-y-1.5">
        <div className="flex items-center justify-between">
          <span>Authentication: HTTP Basic (Password = Git Token)</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateGitToken}
            disabled={isCreatingToken}
            className="min-h-[26px] h-6 px-2.5 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
          >
            {isCreatingToken ? 'Generating...' : 'Generate Git Token'}
          </Button>
        </div>
        {gitToken && (
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-md px-2 py-1">
            <code className="font-mono text-[10px] text-foreground truncate flex-1 select-all">
              {gitToken}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyGitToken}
              className="min-h-[26px] h-6 px-2 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
            >
              {copiedGitToken ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            </Button>
          </div>
        )}
        {gitTokensList.length > 0 && (
          <div className="space-y-1 pt-1">
            {gitTokensList.slice(0, 3).map((tok) => (
              <div
                key={tok.id}
                className="flex items-center justify-between text-[10px] bg-background/60 border border-border/60 rounded px-2 py-0.5"
              >
                <span className="truncate font-mono text-foreground">
                  {tok.label} ({tok.prefix}…)
                </span>
                <button
                  type="button"
                  disabled={revokingTokenId === tok.id}
                  onClick={() => handleRevokeGitToken(tok.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer ml-2 shrink-0 relative after:absolute after:-inset-1.5 after:content-[''] py-0.5"
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
