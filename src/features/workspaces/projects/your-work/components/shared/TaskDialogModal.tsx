'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { TaskDetailModal as TaskDialog } from '@/features/workspaces/projects/project-id/tasks/components/modals/task/TaskDetailModal';
import {
  useProjectTasks,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
} from '@/features/workspaces/projects/project-id/tasks/hooks/use-task';
import type { TaskMutationInput } from '@/features/workspaces/projects/project-id/tasks/types/task.types';
import { useProjectDetails } from '@/features/workspaces/projects/shell/hooks/use-project';

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
  const queryClient = useQueryClient();
  const { workspaceId } = useParams() as { workspaceId: string };

  const { data: projectTasks } = useProjectTasks(projectId);
  const { data: projectDetails } = useProjectDetails(projectId);

  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const duplicateTaskMutation = useDuplicateTask();

  const task = projectTasks?.tasks.find((t: any) => (t.id || t._id) === taskId);
  const columns = projectTasks?.columns || [];
  const pDetails = projectDetails as any;
  const members = pDetails?.members || [];

  const invalidateWorkspaceData = () => {
    if (workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-activity', workspaceId] });
    }
  };

  const handleSave = (data: TaskMutationInput) => {
    updateTaskMutation.mutate(
      {
        taskId,
        projectId,
        ...data,
      },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
        },
      },
    );
  };

  const handleDelete = () => {
    deleteTaskMutation.mutate(
      { taskId, projectId },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
          onOpenChange(false);
        },
      },
    );
  };

  const handleDuplicate = () => {
    duplicateTaskMutation.mutate(
      { taskId, projectId },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
        },
      },
    );
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
