'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/shared/lib/get-query-client';

import { ErrorBoundary } from '@/shared/components/error-boundary/ErrorBoundary';

if (typeof window !== 'undefined') {
  const isAbortError = (err: unknown): boolean => {
    if (!err) return false;
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const name = err instanceof Error ? err.name : '';
    return (
      name === 'AbortError' ||
      name === 'TimeoutError' ||
      msg.includes('aborted') ||
      msg.includes('abort') ||
      msg.includes('signal is aborted') ||
      msg.includes('canceled')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isAbortError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    true,
  );

  window.addEventListener(
    'error',
    (event) => {
      if (isAbortError(event.error) || isAbortError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    true,
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

