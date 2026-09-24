'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function StorageRouteError({
  error,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    logger.error('Storage route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Storage is currently unavailable"
      description="An issue occurred while loading your cloud storage files. Other data and workspaces remain safe."
      error={error}
    />
  );
}
