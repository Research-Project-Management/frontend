import { isServer, QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/shared/types/api.types';
import { getErrorMessage } from '@/shared/utils/error.util';

/**
 * Default query & mutation options shared across server and client instances.
 * Enforces resilient caching, non-blocking background refreshes, and intelligent retries.
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 60 * 1000, // 1 minute fresh cache
    gcTime: 5 * 60 * 1000, // 5 minutes Garbage Collection time
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
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
        const message = getErrorMessage(error) || 'Đã xảy ra lỗi khi thực hiện thao tác';
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
  }
  return browserQueryClient;
}


