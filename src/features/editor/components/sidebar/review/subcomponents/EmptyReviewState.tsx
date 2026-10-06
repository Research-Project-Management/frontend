'use client';

import React from 'react';
import { PlaneEmptyState } from '@/shared/components/ui';

interface EmptyReviewStateProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyReviewState({
  title = 'No comments or suggestions',
  subtitle = 'No one has commented or left any suggestions yet.',
  action,
}: EmptyReviewStateProps) {
  return (
    <PlaneEmptyState
      variant="review"
      isCompact
      title={title}
      description={subtitle}
      action={action}
    />
  );
}

export default EmptyReviewState;
