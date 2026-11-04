'use client';

import React from 'react';
import { useYourWorkContext } from '../context/your-work.context';
import { ActivityFeedList } from '../components/shared/ActivityFeedList';
import { PageLayout } from '../components/shared/PageLayout';
import { EmptyState } from '../components/shared/EmptyState';

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
    <PageLayout isLoading={isLoading} isError={isError} error={error}>
      {activities.length === 0 ? (
        <EmptyState variant="activity" />
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
    </PageLayout>
  );
}

export default ActivityPage;
