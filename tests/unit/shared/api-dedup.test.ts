import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet } from '@/shared/lib/api';

describe('In-Flight Request Deduplication in api.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates simultaneous concurrent GET requests to the same endpoint', async () => {
    let networkFetchCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        networkFetchCount++;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'usr-123', name: 'Test User' }),
        };
      }),
    );

    // Trigger 3 concurrent GET calls simultaneously
    const [res1, res2, res3] = await Promise.all([
      apiGet<{ id: string; name: string }>('/users/me'),
      apiGet<{ id: string; name: string }>('/users/me'),
      apiGet<{ id: string; name: string }>('/users/me'),
    ]);

    expect(networkFetchCount).toBe(1);
    expect(res1).toEqual({ id: 'usr-123', name: 'Test User' });
    expect(res2).toEqual({ id: 'usr-123', name: 'Test User' });
    expect(res3).toEqual({ id: 'usr-123', name: 'Test User' });
  });

  it('triggers a new network fetch after the previous in-flight request has completed', async () => {
    let networkFetchCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        networkFetchCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ count: networkFetchCount }),
        };
      }),
    );

    // Call 1
    const res1 = await apiGet<{ count: number }>('/stats');
    // Call 2 (after Call 1 finishes)
    const res2 = await apiGet<{ count: number }>('/stats');

    expect(networkFetchCount).toBe(2);
    expect(res1.count).toBe(1);
    expect(res2.count).toBe(2);
  });
});
