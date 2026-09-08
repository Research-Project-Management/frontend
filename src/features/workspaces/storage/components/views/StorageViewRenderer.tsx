'use client';

import React from 'react';
import { useViewStore } from '../../store/use-view-store';
import type { StorageViewProps } from '@/features/workspaces/storage/types/storage.types';
import ListView from './ListView';
import GridView from './GridView';

export function StorageViewRenderer(props: StorageViewProps) {
  const { view } = useViewStore();

  if (view === 'list') {
    return <ListView {...props} />;
  }

  return <GridView {...props} />;
}

export default StorageViewRenderer;
