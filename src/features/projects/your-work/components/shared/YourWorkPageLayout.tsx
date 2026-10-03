'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useWorkItemModal } from '../../hooks/use-work-item-modal';
import { WorkItemModalHost } from './WorkItemModalHost';

export interface YourWorkPageLayoutProps {
  isLoading: boolean;
  isError?: boolean;
  error?: any;
  allWorkItems?: any[];
  renderList: (handleOpenItem: (id: string, projectId?: string) => void) => React.ReactNode;
}

export function YourWorkPageLayout({
  isLoading,
  isError = false,
  error = null,
  allWorkItems = [],
  renderList,
}: YourWorkPageLayoutProps) {
  const { selectedWorkItem, handleOpenWorkItem, handleCloseWorkItem } = useWorkItemModal(allWorkItems);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto p-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <PlaneErrorState
          title="Unable to load your work"
          description="An issue occurred while retrieving your work items and activities. Other features remain unaffected."
          error={error || new Error('Internal Server Error')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {renderList(handleOpenWorkItem)}
      <WorkItemModalHost selectedWorkItem={selectedWorkItem} onClose={handleCloseWorkItem} />
    </div>
  );
}

export default YourWorkPageLayout;
