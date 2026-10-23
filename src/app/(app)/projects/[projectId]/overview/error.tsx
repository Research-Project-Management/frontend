'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function ProjectOverviewRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Project overview route error captured', error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <PlaneErrorState
      title="Unable to load project overview"
      description="An issue occurred while loading this project's overview dashboard. Other project modules remain safe."
      error={error}
    />
  );
}
