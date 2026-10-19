'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../views/ListView';
import GridView from '../views/GridView';
import { useViewStore } from '../../store/storage-ui.store';
import type { StorageViewProps } from '../../types/storage.types';
import StorageEmptyState from './StorageEmptyState';
import { PlaneErrorState, type PlaneErrorStateProps } from '@/shared/components/ui/PlaneErrorState';

export interface StorageViewContainerProps {
  isLoading: boolean;
  isError?: boolean;
  error?: PlaneErrorStateProps['error'];
  viewProps: StorageViewProps;
  searchQuery?: string;
}

export function StorageViewContainer({
  isLoading,
  isError = false,
  error = null,
  viewProps,
  searchQuery = '',
}: StorageViewContainerProps) {
  const view = useViewStore((s) => s.view);

  return (
    <div className="flex-1 overflow-auto p-2.5 sm:p-4 md:p-6 bg-background">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <PlaneErrorState
          title="Unable to load files"
          description="An issue occurred while loading files from storage. Other features remain unaffected."
          error={error || new Error('Internal Server Error')}
        />
      ) : viewProps.items.length === 0 ? (
        <StorageEmptyState
          searchQuery={searchQuery}
          isTrash={viewProps.isTrash}
        />
      ) : view === 'list' ? (
        <ListView {...viewProps} />
      ) : (
        <GridView {...viewProps} />
      )}
    </div>
  );
}
