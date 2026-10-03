'use client';

import React from 'react';
import { useActivityFeed } from '../hooks/use-activity-feed';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';
import { YourWorkEmptyState } from '../components/shared/YourWorkEmptyState';

export function ActivityPage() {
  const { state } = useActivityFeed();
  const {
    allWorkItems,
    activities,
    workItemProjectMap,
    isLoading,
    isLoadingActivity,
    isError,
    error,
  } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      isError={isError}
      error={error}
      allWorkItems={allWorkItems}
      renderList={(handleOpenItem) =>
        activities.length === 0 ? (
          <YourWorkEmptyState variant="activity" />
        ) : (
          <ActivityTimeline
            activities={activities}
            isLoading={isLoadingActivity}
            onWorkItemClick={handleOpenItem}
            workItemProjectMap={workItemProjectMap}
          />
        )
      }
    />
  );
}

export default ActivityPage;
