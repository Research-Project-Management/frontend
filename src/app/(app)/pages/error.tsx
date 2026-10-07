'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function PagesRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Pages route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Pages is currently unavailable"
      description="An issue occurred while loading workspace documents. Other project data and modules remain safe."
      error={error}
    />
  );
}
