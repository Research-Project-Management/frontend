'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DetailModal as TaskDialog } from '@/features/workspaces/projects/project-id/work-items/components/modals/DetailModal';
import {
  useProjectTasks,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
} from '@/features/workspaces/projects/project-id/work-items/hooks/use-tasks';
import type { TaskMutationInput } from '@/features/workspaces/projects/project-id/work-items/types/types';
import { useProjectDetails } from '@/features/workspaces/projects/shell/hooks/use-project';

export interface TaskDialogModalProps {
  taskId: string;
  projectId: string;
  initialTask?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLUMNS = [
  { id: 'backlog', title: 'Backlog', isDefault: true, accentColor: '#6366F1' },
  { id: 'todo', title: 'To Do', isDefault: true, accentColor: '#0EA5E9' },
  { id: 'doing', title: 'Doing', isDefault: true, accentColor: '#F59E0B' },
  { id: 'review', title: 'Review', isDefault: true, accentColor: '#eab308' },
  { id: 'done', title: 'Done', isDefault: true, accentColor: '#22c55e' },
];

export function TaskDialogModal({
  taskId,
  projectId,
  initialTask,
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

  const fetchedTask = projectTasks?.tasks.find((t: any) => t.id === taskId);
  const task = fetchedTask || initialTask;
  const columns =
    projectTasks?.columns && projectTasks.columns.length > 0
      ? projectTasks.columns
      : (projectDetails as any)?.taskColumns && Array.isArray((projectDetails as any).taskColumns)
        ? (projectDetails as any).taskColumns
        : DEFAULT_COLUMNS;
  const pDetails = projectDetails as any;
  const members = pDetails?.members || [];

  const invalidateWorkspaceData = () => {
    if (workspaceId) {
      queryClient.invalidateQueries({ queryKey: ['your-work', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
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
