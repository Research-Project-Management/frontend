'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useOptionalYourWorkContext } from '../../context/your-work.context';

export interface YourWorkPageLayoutProps {
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  children?: React.ReactNode;
  renderList?: (handleOpenItem: (id: string, projectId?: string) => void) => React.ReactNode;
}

export function YourWorkPageLayout({
  isLoading,
  isError = false,
  error = null,
  children,
  renderList,
}: YourWorkPageLayoutProps) {
  const context = useOptionalYourWorkContext();
  const handleOpenWorkItem = context?.openWorkItem ?? (() => {});

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
      {renderList ? renderList(handleOpenWorkItem) : children}
    </div>
  );
}

export default YourWorkPageLayout;

