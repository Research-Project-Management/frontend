/**
 * useGitClone.ts
 *
 * Hook managing Git Smart-HTTP repository metadata, Personal Access Token lifecycle,
 * and clipboard copy state across both Personal Space and Project Space.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  gitApi,
  type GitRepoInfo,
  type GitToken,
} from '@/features/editor/sdk/pages/git.client';

const DEFAULT_MAX_TOKENS = 10;
const COPY_RESET_MS = 2_000;

function useCopyFlag() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback((text: string, toastId: string, msg: string) => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(msg, { id: toastId });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCopied(false);
    }, COPY_RESET_MS);
  }, []);

  return { copied, copy };
}

export interface UseGitCloneParams {
  projectId: string;
  pageId?: string;
  open: boolean;
}

export function useGitClone({ projectId, pageId, open }: UseGitCloneParams) {
  const [info, setInfo] = useState<GitRepoInfo | null>(null);
  const [tokens, setTokens] = useState<GitToken[]>([]);
  const [label, setLabel] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const urlCopy = useCopyFlag();
  const tokenCopy = useCopyFlag();

  useEffect(() => {
    const spaceId = projectId?.trim() || (pageId?.trim() ? 'personal' : '');
    if (!spaceId || !open) return;

    let cancelled = false;
    setLoading(true);

    gitApi
      .getRepoInfo(spaceId, { pageId })
      .then((res) => {
        if (cancelled || !res) return;
        setInfo(res);
        setTokens(Array.isArray(res.tokens) ? res.tokens : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, pageId, open]);

  const fallbackId = pageId || projectId || 'project';
  const cloneUrl =
    info?.cloneUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/git/${fallbackId}.git`
      : `https://git.flux.app/git/${fallbackId}.git`);

  const maxTokens = info?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const username = info?.username || 'git';
  const branch = info?.branch || 'main';
  const canPush = info ? info.canPush : true;
  const atLimit = tokens.length >= maxTokens;

  const createToken = useCallback(async () => {
    if (atLimit) {
      toast.error(`Maximum of ${maxTokens} active tokens reached`, { id: 'git-token-create' });
      return;
    }
    setCreating(true);
    try {
      const name = label.trim() || `Token ${new Date().toLocaleDateString()}`;
      const created = await gitApi.createToken(name);
      setNewToken(created.token);
      setLabel('');
      setTokens((prev) => [
        {
          id: created.id,
          label: created.label,
          prefix: created.prefix,
          createdAt: created.createdAt,
          expiresAt: created.expiresAt,
          lastUsedAt: created.lastUsedAt ?? null,
        },
        ...prev.filter((t) => t.id !== created.id),
      ]);
      toast.success('Git access token created', { id: 'git-token-create' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to create token', { id: 'git-token-create' });
    } finally {
      setCreating(false);
    }
  }, [atLimit, label, maxTokens]);

  const revokeToken = useCallback(async (tokenId: string) => {
    setRevokingId(tokenId);
    try {
      await gitApi.revokeToken(tokenId);
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
      toast.success('Git access token revoked', { id: 'git-token-revoke' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to revoke token', { id: 'git-token-revoke' });
    } finally {
      setRevokingId(null);
    }
  }, []);

  const copyUrl = useCallback(() => {
    urlCopy.copy(
      `git clone ${cloneUrl}`,
      'copy-git-url',
      'Copied git clone command',
    );
  }, [cloneUrl, urlCopy]);

  const copyToken = useCallback(() => {
    if (!newToken) return;
    tokenCopy.copy(newToken, 'copy-git-token', 'Copied access token');
  }, [newToken, tokenCopy]);

  return {
    cloneUrl,
    branch,
    username,
    canPush,
    tokens,
    maxTokens,
    atLimit,
    label,
    setLabel,
    newToken,
    loading,
    creating,
    revokingId,
    copiedUrl: urlCopy.copied,
    copiedToken: tokenCopy.copied,
    copyUrl,
    copyToken,
    createToken,
    revokeToken,
  };
}
