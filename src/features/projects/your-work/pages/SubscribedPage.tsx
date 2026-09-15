'use client';

import React from 'react';
import { useSubscribedWork } from '../hooks/use-subscribed-work';
import { SubscribedWorkItemList } from '../components/subscribed/SubscribedWorkItemList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function SubscribedPage() {
  const { state } = useSubscribedWork();
  const { allWorkItems, subscribedWorkItems, workItemProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allWorkItems={allWorkItems}
      renderList={(handleOpenItem) => (
        <SubscribedWorkItemList
          workItems={subscribedWorkItems}
          onWorkItemClick={handleOpenItem}
          workItemProjectMap={workItemProjectMap}
        />
      )}
    />
  );
}

export default SubscribedPage;
