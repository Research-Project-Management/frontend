'use client';

import React, { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

export default function EditorRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Editor route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <PlaneErrorState
      isFullPage
      title="Editor encountered an issue"
      description="An unexpected error occurred while rendering the document. Your previously saved edits remain secure in cache."
      error={error}
    />
  );
}

