import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gitApi } from '@/features/editor/sdk/pages/git.client';

const apiMocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  apiGet: apiMocks.apiGet,
  apiPost: apiMocks.apiPost,
  apiDelete: apiMocks.apiDelete,
}));

describe('gitApi (Frontend 1:1 SDK with Backend GitSettingsController)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes pageId query param when distinct from spaceId and coalesces concurrent in-flight reads', async () => {
    let resolveDeferred!: (value: unknown) => void;
    apiMocks.apiGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeferred = resolve;
      }),
    );

    const p1 = gitApi.getRepoInfo('space-1', { pageId: 'page-9' });
    const p2 = gitApi.getRepoInfo('space-1', { pageId: 'page-9' });

    expect(apiMocks.apiGet).toHaveBeenCalledTimes(1);
    expect(apiMocks.apiGet).toHaveBeenCalledWith(
      '/api/v1/pages/spaces/space-1/git?pageId=page-9',
    );

    const mockInfo = {
      enabled: true,
      repoId: 'page-9',
      cloneUrl: 'http://localhost:18300/git/page-9.git',
      branch: 'main',
      username: 'git',
      canPush: true,
      maxTokens: 10,
      tokens: [],
    };
    resolveDeferred(mockInfo);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(mockInfo);
    expect(r2).toEqual(mockInfo);
  });

  it('creates and revokes tokens against canonical /pages/git/tokens endpoints', async () => {
    apiMocks.apiPost.mockResolvedValueOnce({
      id: 'tok-1',
      label: 'Laptop',
      prefix: 'fluxpat_abcd1234',
      token: 'fluxpat_abcd1234secretvalue9999999999',
      createdAt: '2026-11-28T00:00:00.000Z',
      expiresAt: '2027-11-28T00:00:00.000Z',
      lastUsedAt: null,
    });
    apiMocks.apiDelete.mockResolvedValueOnce({ success: true });

    const created = await gitApi.createToken('  Laptop  ');
    expect(apiMocks.apiPost).toHaveBeenCalledWith('/api/v1/pages/git/tokens', {
      label: 'Laptop',
    });
    expect(created.prefix).toBe('fluxpat_abcd1234');

    const revoked = await gitApi.revokeToken('tok-1');
    expect(apiMocks.apiDelete).toHaveBeenCalledWith(
      '/api/v1/pages/git/tokens/tok-1',
    );
    expect(revoked).toEqual({ success: true });
  });
});
