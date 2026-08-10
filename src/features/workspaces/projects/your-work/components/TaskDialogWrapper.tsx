'use client';

import { TaskDialog } from "@/features/workspaces/projects/project-id/tasks/components/CardDetail";
import { useProjectTasks, useUpdateTask, useDeleteTask, useDuplicateTask } from "@/features/workspaces/projects/project-id/tasks";
import { useProjectDetails } from "@/features/workspaces";
import { useParams } from "next/navigation";
import type { Task, TaskMutationInput } from "@/features/workspaces/projects/project-id/tasks/types/task.types";

type TaskDialogWrapperProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string;
};

export default function TaskDialogWrapper({ open, onOpenChange, taskId, projectId }: TaskDialogWrapperProps) {
  const { data: projectTasks } = useProjectTasks(projectId);
  const { data: projectDetails } = useProjectDetails(projectId);
  
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const duplicateTaskMutation = useDuplicateTask();

  const task = projectTasks?.tasks.find(t => t._id === taskId);
  const columns = projectTasks?.columns || [];
  const pDetails = projectDetails as any;
  const members = pDetails?.members || [];

  const handleSave = (data: TaskMutationInput) => {
    updateTaskMutation.mutate({
      taskId,
      projectId,
      ...data
    });
  };

  const handleDelete = () => {
    deleteTaskMutation.mutate({
      taskId,
      projectId
    }, {
        onSuccess: () => {
            onOpenChange(false);
        }
    });
  };

  const handleDuplicate = () => {
    duplicateTaskMutation.mutate({
      taskId,
      projectId
    });
  };

  if (!task && !isLoading) return null;

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

// Add a simple loading check if needed, but TaskDialog handles initial state well
const isLoading = false; 
