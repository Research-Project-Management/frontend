'use client';

import React from 'react';
import { useAssignedWork } from '../hooks/use-assigned-work';
import { AssignedTaskList } from '../components/assigned/AssignedTaskList';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function AssignedPage() {
  const { state } = useAssignedWork();
  const { allTasks, assignedTasks, taskProjectMap, isLoading } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allTasks={allTasks}
      renderList={(handleOpenTask) => (
        <AssignedTaskList
          tasks={assignedTasks}
          onTaskClick={handleOpenTask}
          taskProjectMap={taskProjectMap}
        />
      )}
    />
  );
}

export default AssignedPage;
