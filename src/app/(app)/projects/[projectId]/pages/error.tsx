'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function ProjectPagesRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Project pages route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Project pages are currently unavailable"
      description="An issue occurred while loading documents for this project. Other project data and modules remain safe."
      error={error}
    />
  );
}
