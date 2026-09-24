'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('App route crashed', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="This view encountered an issue"
      description="Unable to load data for the current view. Navigation and other workspaces remain safe."
      error={error}
    />
  );
}

