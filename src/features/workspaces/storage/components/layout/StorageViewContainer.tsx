'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import ListView, { type StorageViewProps } from '../views/ListView';
import GridView from '../views/GridView';
import { useViewStore } from '../../store/use-view-store';

export interface StorageViewContainerProps {
  isLoading: boolean;
  workspaceId?: string | null;
  viewProps: StorageViewProps;
}

export function StorageViewContainer({
  isLoading,
  workspaceId,
  viewProps,
}: StorageViewContainerProps) {
  const { view } = useViewStore();

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        </div>
      ) : !workspaceId ? (
        <div className="p-6 text-muted-foreground">Workspace not found</div>
      ) : view === 'list' ? (
        <ListView {...viewProps} />
      ) : (
        <GridView {...viewProps} />
      )}
    </div>
  );
}
