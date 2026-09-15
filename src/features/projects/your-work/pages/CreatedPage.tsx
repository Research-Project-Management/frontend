'use client';

import React from 'react';
import { useCreatedWork } from '../hooks/use-created-work';
import { CreatedWorkItemList } from '../components/created/CreatedWorkItemList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function CreatedPage() {
  const { state } = useCreatedWork();
  const { allWorkItems, createdWorkItems, workItemProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allWorkItems={allWorkItems}
      renderList={(handleOpenItem) => (
        <CreatedWorkItemList
          workItems={createdWorkItems}
          onWorkItemClick={handleOpenItem}
          workItemProjectMap={workItemProjectMap}
        />
      )}
    />
  );
}

export default CreatedPage;
