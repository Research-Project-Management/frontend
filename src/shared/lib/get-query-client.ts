import { isServer, QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/shared/types/api.types';
import { getErrorMessage } from '@/shared/utils/error.util';
import { QUERY_TIMINGS } from '@/config/query';
import { memoryGovernor } from '@/shared/lib/memory-governor';

/**
 * Default query & mutation options shared across server and client instances.
 * Enforces resilient caching, non-blocking background refreshes, and intelligent retries.
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: QUERY_TIMINGS.DEFAULT_STALE,
    gcTime: QUERY_TIMINGS.LONG,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Do NOT retry aborted requests (cancelled by navigation or unmount)
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted'))
      ) {
        return false;
      }
      // Do NOT retry client errors (400, 401, 403, 404, 422)
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      // Retry transient network / 5xx errors up to 2 times
      return failureCount < 2;
    },
  },
  mutations: {
    onError: (error: unknown) => {
      if (typeof window !== 'undefined') {
        if (
          error instanceof Error &&
          (error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted'))
        ) {
          return;
        }
        const message = getErrorMessage(error) || 'An error occurred while processing your request.';
        toast.error(message);
      }
    },
  },
};

/**
 * Factory creating a fully configured QueryClient instance.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Global QueryClient Seam for Next.js App Router.
 * - Server Components / SSR: Creates a fresh request-scoped QueryClient for prefetching.
 * - Browser: Creates and returns a stable singleton to prevent re-instantiation across Suspense boundaries.
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    // Server: always create a fresh query client
    return makeQueryClient();
  }
  // Browser: initialize singleton once and reuse
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
    const client = browserQueryClient;
    memoryGovernor.register({
      id: 'tanstack-query-cache',
      domain: 'global',
      priority: 80,
      reclaim: ({ level }) => {
        if (level === 'logout') {
          const count = client.getQueryCache().getAll().length;
          client.clear();
          return count;
        }
        if (level === 'pressure' || level === 'tab-hidden') {
          const before = client.getQueryCache().getAll().length;
          client.removeQueries({ type: 'inactive' });
          const after = client.getQueryCache().getAll().length;
          return Math.max(0, before - after);
        }
        return 0;
      },
      getStats: () => {
        const allQueries = client.getQueryCache().getAll();
        let activeCount = 0;
        for (const q of allQueries) {
          if (q.getObserversCount() > 0) activeCount += 1;
        }
        return {
          id: 'tanstack-query-cache',
          domain: 'global',
          entryCount: allQueries.length,
          details: {
            activeQueries: activeCount,
            inactiveQueries: allQueries.length - activeCount,
          },
        };
      },
    });
  }
  return browserQueryClient;
}


