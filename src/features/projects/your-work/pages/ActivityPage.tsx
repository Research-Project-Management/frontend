'use client';

import React from 'react';
import { useYourWorkContext } from '../context/your-work.context';
import { ActivityFeedList } from '../components/shared/ActivityFeedList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';
import { YourWorkEmptyState } from '../components/shared/YourWorkEmptyState';

export function ActivityPage() {
  const {
    activities,
    workItemProjectMap,
    isLoading,
    isLoadingYourWork,
    isError,
    error,
    openWorkItem,
  } = useYourWorkContext();

  return (
    <YourWorkPageLayout isLoading={isLoading} isError={isError} error={error}>
      {activities.length === 0 ? (
        <YourWorkEmptyState variant="activity" />
      ) : (
        <ActivityFeedList
          title="Recent activity"
          showCount
          items={activities}
          isLoading={isLoadingYourWork}
          onWorkItemClick={openWorkItem}
          workItemProjectMap={workItemProjectMap}
          emptyPadding="py-12"
        />
      )}
    </YourWorkPageLayout>
  );
}

export default ActivityPage;

