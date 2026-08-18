/**
 * query-client.test.ts
 *
 * Unit tests for the QueryClient Factory and App Router Lifecycle Seam.
 */

import { describe, it, expect, vi } from 'vitest';
import { makeQueryClient, getQueryClient, defaultQueryOptions } from '@/shared/lib/get-query-client';
import { ApiError } from '@/shared/types/api.types';

describe('QueryClient Seam', () => {
  it('instantiates QueryClient with default options', () => {
    const client = makeQueryClient();
    const queryDefaults = client.getDefaultOptions().queries;
    const mutationDefaults = client.getDefaultOptions().mutations;

    expect(queryDefaults?.staleTime).toBe(60 * 1000);
    expect(queryDefaults?.gcTime).toBe(5 * 60 * 1000);
    expect(queryDefaults?.refetchOnWindowFocus).toBe(false);
    expect(queryDefaults?.refetchOnReconnect).toBe(true);
    expect(mutationDefaults?.onError).toBeDefined();
  });

  it('does not retry on 4xx client errors in retry policy', () => {
    const retryFn = defaultQueryOptions.queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    const clientError = new ApiError({
      message: 'Not found',
      statusCode: 404,
    });

    const isRetryable = retryFn(0, clientError);
    expect(isRetryable).toBe(false);
  });

  it('retries transient 5xx errors up to 2 times', () => {
    const retryFn = defaultQueryOptions.queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    const serverError = new ApiError({
      message: 'Internal Server Error',
      statusCode: 500,
    });

    expect(retryFn(0, serverError)).toBe(true);
    expect(retryFn(1, serverError)).toBe(true);
    expect(retryFn(2, serverError)).toBe(false);
  });

  it('returns a stable singleton on repeated browser calls', () => {
    const clientA = getQueryClient();
    const clientB = getQueryClient();

    expect(clientA).toBe(clientB);
  });
});
