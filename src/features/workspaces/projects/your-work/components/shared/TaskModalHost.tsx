'use client';

import React from 'react';
import { TaskDialogModal } from './TaskDialogModal';

export interface TaskModalHostProps {
  selectedTask: { taskId: string; projectId: string; task?: any } | null;
  onClose: () => void;
}

export function TaskModalHost({ selectedTask, onClose }: TaskModalHostProps) {
  if (!selectedTask) return null;

  return (
    <TaskDialogModal
      taskId={selectedTask.taskId}
      projectId={selectedTask.projectId}
      initialTask={selectedTask.task}
      open={Boolean(selectedTask)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}
