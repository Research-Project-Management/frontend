'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { toast } from 'sonner';
import { defaultQueryOptions } from '@/shared/lib/get-query-client';

export default function Providers({ children }: { children: React.ReactNode }) {
  /**
   * Singleton QueryClient for the client-side React tree.
   * useState ensures a single instance is created per component mount,
   * avoiding re-creation on every render.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          ...defaultQueryOptions,
          mutations: {
            // Global mutation error handler – surface errors via Sonner toast
            onError: (error: unknown) => {
              const message =
                (error as { message?: string })?.message ?? 'Đã xảy ra lỗi';
              toast.error(message);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
