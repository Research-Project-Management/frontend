'use client';

import React from 'react';
import '@/shared/styles/globals.css';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="font-sans antialiased" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground min-h-dvh flex flex-col"
        suppressHydrationWarning
      >
        <PlaneErrorState
          isFullPage
          title="An unexpected error occurred"
          description="The application encountered an unexpected rendering error. Your saved data remains safe."
          error={error}
          reset={reset}
        />
      </body>
    </html>
  );
}
