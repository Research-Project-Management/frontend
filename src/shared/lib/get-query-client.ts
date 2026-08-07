import { cache } from 'react';
import { QueryClient } from '@tanstack/react-query';

/**
 * Default query options – shared between server and client QueryClient instances.
 */
export const defaultQueryOptions = {
  queries: {
    staleTime: 60 * 1_000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 1,
  },
} as const;

/**
 * Server-side QueryClient: scoped per request via React `cache()`.
 * Safe to call in Server Components and Route Handlers.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: defaultQueryOptions,
    })
);
