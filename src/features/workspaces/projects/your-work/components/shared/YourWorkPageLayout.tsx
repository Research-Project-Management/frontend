'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useTaskModal } from '../../hooks/use-task-modal';
import { TaskDialogModal } from './TaskDialogModal';

interface YourWorkPageLayoutProps {
  isLoading: boolean;
  allTasks: any[];
  renderList: (onTaskClick: (taskId: string, projectId?: string) => void) => React.ReactNode;
}

export function YourWorkPageLayout({ isLoading, allTasks, renderList }: YourWorkPageLayoutProps) {
  const { selectedTask, handleOpenTask, handleCloseTask } = useTaskModal(allTasks);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto p-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {renderList(handleOpenTask)}

      {selectedTask && (
        <TaskDialogModal
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onOpenChange={(open) => !open && handleCloseTask()}
        />
      )}
    </div>
  );
}
