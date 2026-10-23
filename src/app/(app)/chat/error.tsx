'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function ChatRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    logger.error('Chat route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      title="Chat is currently unavailable"
      description="An issue occurred while loading messages and channels. Other workspaces remain safe."
      error={error}
      reset={reset}
      isFullPage
    />
  );
}
