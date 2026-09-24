'use client';

import React from 'react';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PlaneErrorState
      isFullPage
      title="An unexpected error occurred"
      description="The application encountered an unexpected rendering error. Your saved data remains safe."
      error={error}
    />
  );
}

