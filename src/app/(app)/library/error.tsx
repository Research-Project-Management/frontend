'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function LibraryRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Library route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Library is currently unavailable"
      description="An issue occurred while loading your library references. Other data and modules remain safe."
      error={error}
    />
  );
}

