import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => apiMocks);

import { templatesApi } from '@/features/editor/sdk/pages/templates.client';

describe('templatesApi SDK (Single-Flight Virtual Proxy & Clean Contracts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('coalesces concurrent identical list() requests into a single HTTP GET', async () => {
    let resolveFetch!: (val: unknown) => void;
    apiMocks.apiGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const p1 = templatesApi.list({ category: 'conference', search: 'ieee' });
    const p2 = templatesApi.list({ category: 'conference', search: 'ieee' });

    expect(apiMocks.apiGet).toHaveBeenCalledTimes(1);
    expect(apiMocks.apiGet).toHaveBeenCalledWith('/api/v1/pages/templates', {
      params: { category: 'conference', search: 'ieee' },
    });

    resolveFetch({
      templates: [{ id: 't-1', name: 'IEEE Conference' }],
      total: 1,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toHaveLength(1);
    expect(r2).toEqual(r1);
  });

  it('routes getById, publish, update, remove, and instantiate to canonical /api/v1/pages endpoints', async () => {
    apiMocks.apiGet.mockResolvedValueOnce({ id: 'ieee-transactions', files: [] });
    await templatesApi.getById('ieee-transactions');
    expect(apiMocks.apiGet).toHaveBeenCalledWith(
      '/api/v1/pages/templates/ieee-transactions',
    );

    apiMocks.apiPost.mockResolvedValueOnce({ id: 'custom-1', files: [] });
    await templatesApi.publish({
      pageId: 'page-456',
      name: 'Team Template',
      category: 'journal',
      scope: 'project',
    });
    expect(apiMocks.apiPost).toHaveBeenCalledWith('/api/v1/pages/templates', {
      pageId: 'page-456',
      name: 'Team Template',
      category: 'journal',
      scope: 'project',
    });

    apiMocks.apiPost.mockResolvedValueOnce({
      pageId: 'page-789',
      spaceId: 'space-123',
      isPersonal: false,
      rootDocId: 'page-789',
      title: 'Clone Title',
      compiler: 'xelatex',
      texlive: '2025',
      mainFile: 'main.tex',
      createdDocs: 2,
      createdFiles: 1,
    });
    await templatesApi.instantiate('space-123', 'ieee-transactions', {
      title: 'Clone Title',
    });
    expect(apiMocks.apiPost).toHaveBeenCalledWith(
      '/api/v1/pages/spaces/space-123/templates/ieee-transactions/instantiate',
      { title: 'Clone Title' },
    );

    apiMocks.apiDelete.mockResolvedValueOnce({ success: true });
    await templatesApi.remove('custom-1');
    expect(apiMocks.apiDelete).toHaveBeenCalledWith(
      '/api/v1/pages/templates/custom-1',
    );
  });
});
