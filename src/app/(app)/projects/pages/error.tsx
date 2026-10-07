'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function ProjectsPagesRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Projects pages route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Workspace pages are currently unavailable"
      description="An issue occurred while loading workspace documents. Other project data and modules remain safe."
      error={error}
    />
  );
}
