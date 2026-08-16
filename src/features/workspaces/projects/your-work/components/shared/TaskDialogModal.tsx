'use client';

import React from 'react';
import {
  TaskDialog,
  useProjectTasks,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
  type TaskMutationInput,
} from '@/features/workspaces/projects/project-id/tasks';
import { useProjectDetails } from '@/features/workspaces/projects/shell';

export interface TaskDialogModalProps {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDialogModal({
  taskId,
  projectId,
  open,
  onOpenChange,
}: TaskDialogModalProps) {
  const { data: projectTasks } = useProjectTasks(projectId);
  const { data: projectDetails } = useProjectDetails(projectId);

  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const duplicateTaskMutation = useDuplicateTask();

  const task = projectTasks?.tasks.find((t: any) => (t.id || t._id) === taskId);
  const columns = projectTasks?.columns || [];
  const pDetails = projectDetails as any;
  const members = pDetails?.members || [];

  const handleSave = (data: TaskMutationInput) => {
    updateTaskMutation.mutate({
      taskId,
      projectId,
      ...data,
    });
  };

  const handleDelete = () => {
    deleteTaskMutation.mutate(
      { taskId, projectId },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleDuplicate = () => {
    duplicateTaskMutation.mutate({ taskId, projectId });
  };

  if (!task) return null;

  return (
    <TaskDialog
      open={open}
      onOpenChange={onOpenChange}
      card={task}
      columns={columns}
      members={members}
      onSave={handleSave}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
    />
  );
}

export default TaskDialogModal;
