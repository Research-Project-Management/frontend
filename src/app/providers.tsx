'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from "@/shared/lib/get-query-client";

import { ErrorBoundary } from "@/shared/components/ui";
import { TooltipProvider } from "@/shared/components/ui";
import { ThemeProvider } from "@/shared/providers";


export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={1000} skipDelayDuration={300} disableHoverableContent={true}>
            {children}
          </TooltipProvider>
          {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === 'true' && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          )}
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

