'use client';

import React from 'react';
import { useSubscribedWork } from '../hooks/use-subscribed-work';
import { SubscribedTaskList } from '../components/subscribed/SubscribedTaskList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function SubscribedPage() {
  const { state } = useSubscribedWork();
  const { allTasks, subscribedTasks, taskProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allTasks={allTasks}
      renderList={(handleOpenTask) => (
        <SubscribedTaskList
          tasks={subscribedTasks}
          onTaskClick={handleOpenTask}
          taskProjectMap={taskProjectMap}
        />
      )}
    />
  );
}

export default SubscribedPage;
