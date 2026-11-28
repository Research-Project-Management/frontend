/**
 * git.client.ts
 *
 * GoF Facade + Virtual Single-Flight Proxy (`coalesce`) for Backend `TokenController`.
 */

import { apiDelete, apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';

export interface GitToken {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export interface CreatedGitToken extends GitToken {
  token: string;
}

export interface GitRepoInfo {
  enabled: boolean;
  repoId: string;
  cloneUrl: string;
  branch: string;
  username: string;
  canPush: boolean;
  maxTokens: number;
  tokens: GitToken[];
}

const inFlight = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) return active;

  const req = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, req);
  return req;
}

export const gitApi = {
  getRepoInfo: (
    spaceId: string,
    opts?: { pageId?: string },
  ): Promise<GitRepoInfo> => {
    const sid = spaceId.trim();
    const pid = opts?.pageId?.trim();
    const qs = pid && pid !== sid ? `?pageId=${encodeURIComponent(pid)}` : '';
    return coalesce(`repo:${sid}:${pid ?? ''}`, () =>
      apiGet<GitRepoInfo>(
        `${PAGES_API_BASE}/spaces/${encodeURIComponent(sid)}/git${qs}`,
      ),
    );
  },

  createToken: (label?: string): Promise<CreatedGitToken> => {
    const clean = label?.trim();
    return apiPost<CreatedGitToken>(`${PAGES_API_BASE}/git/tokens`, {
      ...(clean ? { label: clean.slice(0, 100) } : {}),
    });
  },

  revokeToken: (tokenId: string): Promise<{ success: boolean }> =>
    apiDelete<{ success: boolean }>(
      `${PAGES_API_BASE}/git/tokens/${encodeURIComponent(tokenId)}`,
    ),
};
