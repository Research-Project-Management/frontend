'use client';

import React from 'react';
import { PagesEmptyState, type PagesEmptyStateProps } from './PagesEmptyState';

export type EmptyStateProps = PagesEmptyStateProps;

export function EmptyState(props: EmptyStateProps) {
  return <PagesEmptyState {...props} />;
}

export default EmptyState;
