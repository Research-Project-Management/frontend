'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function ExperimentsRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    logger.error('Experiments route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Experiments workspace is currently unavailable"
      description="An issue occurred while loading your experiment runs and research artifacts."
      error={error}
      reset={reset}
    />
  );
}
