'use client';

import React from 'react';
import { useCreatedWork } from '../hooks/use-created-work';
import { CreatedTaskList } from '../components/created/CreatedTaskList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function CreatedPage() {
  const { state } = useCreatedWork();
  const { allTasks, createdTasks, taskProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allTasks={allTasks}
      renderList={(handleOpenTask) => (
        <CreatedTaskList
          tasks={createdTasks}
          onTaskClick={handleOpenTask}
          taskProjectMap={taskProjectMap}
        />
      )}
    />
  );
}

export default CreatedPage;
