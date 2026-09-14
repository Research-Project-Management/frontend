'use client';

import React from 'react';
import { useAssignedWork } from '../hooks/use-assigned-work';
import { AssignedWorkItemList } from '../components/assigned/AssignedWorkItemList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function AssignedPage() {
  const { state } = useAssignedWork();
  const { allWorkItems, assignedWorkItems, workItemProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allWorkItems={allWorkItems}
      renderList={(handleOpenItem) => (
        <AssignedWorkItemList
          workItems={assignedWorkItems}
          onWorkItemClick={handleOpenItem}
          workItemProjectMap={workItemProjectMap}
        />
      )}
    />
  );
}

export default AssignedPage;
