'use client';

/**
 * EditorEmptyState.tsx
 * Canonical re-export pointing to global @/shared/components/ui/PlaneEmptyState.
 * Eliminates locally duplicated illustrations and maintains global design system parity.
 */

import React from 'react';
import {
  PlaneEmptyState,
  type PlaneEmptyStateProps,
  type PlaneEmptyVariant,
  type PlaneEmptyAction,
} from '@/shared/components/ui/PlaneEmptyState';

export type EditorEmptyVariant = PlaneEmptyVariant;
export type EditorEmptyAction = PlaneEmptyAction;
export type EditorEmptyStateProps = PlaneEmptyStateProps;

export const EditorEmptyState = React.memo(function EditorEmptyState(props: EditorEmptyStateProps) {
  return <PlaneEmptyState {...props} />;
});

export default EditorEmptyState;
