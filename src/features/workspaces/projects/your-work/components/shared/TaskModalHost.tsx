'use client';

import React from 'react';
import { TaskDialogModal } from './TaskDialogModal';

export interface TaskModalHostProps {
  selectedTask: { taskId: string; projectId: string } | null;
  onClose: () => void;
}

export function TaskModalHost({ selectedTask, onClose }: TaskModalHostProps) {
  if (!selectedTask) return null;

  return (
    <TaskDialogModal
      taskId={selectedTask.taskId}
      projectId={selectedTask.projectId}
      open={Boolean(selectedTask)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}
