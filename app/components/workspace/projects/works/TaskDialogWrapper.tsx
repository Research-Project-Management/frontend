import { TaskDialog } from "../$projectId/Task/task_dialog/CardDetail";
import { useProjectTasks, useUpdateTask, useDeleteTask, useDuplicateTask } from "~/query/task";
import { useProjectDetails } from "~/query/project";
import { useParams } from "react-router";
import type { Task, TaskMutationInput } from "~/types/task";

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
  const members = projectDetails?.members || [];

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
