'use client';

/**
 * safe-query-client.ts
 *
 * Provides a resilient QueryClient fallback for TanStack Query hooks.
 * Guarantees zero "No QueryClient set, use QueryClientProvider to set one" runtime exceptions
 * in isolated unit test environments, SSR pipelines, and decoupled components.
 */

import { useContext } from 'react';
import { QueryClientContext, QueryClient } from '@tanstack/react-query';

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
      gcTime: 0,
    },
  },
});

export function useSafeQueryClient(overrideClient?: QueryClient): QueryClient {
  const contextClient = useContext(QueryClientContext);
  return overrideClient || contextClient || fallbackQueryClient;
}
