'use client';

import React from 'react';
import { useYourWorkContext } from '../context/your-work.context';
import { YourWorkItemList } from '../components/shared/YourWorkItemList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function SubscribedPage() {
  const { subscribed, workItemProjectMap, isLoading, isError, error, openWorkItem } =
    useYourWorkContext();

  return (
    <YourWorkPageLayout isLoading={isLoading} isError={isError} error={error}>
      <YourWorkItemList
        variant="subscribed"
        workItems={subscribed}
        onWorkItemClick={openWorkItem}
        workItemProjectMap={workItemProjectMap}
      />
    </YourWorkPageLayout>
  );
}

export default SubscribedPage;

