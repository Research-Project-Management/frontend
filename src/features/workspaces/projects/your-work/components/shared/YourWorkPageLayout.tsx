'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import { useTaskModal } from '../../hooks/use-task-modal';
import { TaskModalHost } from './TaskModalHost';

export interface YourWorkPageLayoutProps {
  isLoading: boolean;
  allTasks?: any[];
  renderList: (handleOpenTask: (taskId: string, projectId?: string) => void) => React.ReactNode;
}

export function YourWorkPageLayout({
  isLoading,
  allTasks = [],
  renderList,
}: YourWorkPageLayoutProps) {
  const { selectedTask, handleOpenTask, handleCloseTask } = useTaskModal(allTasks);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto p-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-32 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {renderList(handleOpenTask)}
      <TaskModalHost selectedTask={selectedTask} onClose={handleCloseTask} />
    </div>
  );
}

export default YourWorkPageLayout;
