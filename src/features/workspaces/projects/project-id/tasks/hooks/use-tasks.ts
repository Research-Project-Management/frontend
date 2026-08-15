'use client';

import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { TaskService } from "../services/task.services";
import type { Task, TaskMutationInput, ProjectTasksData } from "../types/task.types";

// ── Query Keys ───────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ["tasks"] as const,
  project: (projectId: string, cycleId?: string) =>
    ["tasks", projectId, cycleId] as const,
  workspace: (workspaceId: string) =>
    ["workspace-tasks", workspaceId] as const,
  comments: (taskId: string) =>
    ["task-comments", taskId] as const,
  activity: (taskId: string) =>
    ["task-activity", taskId] as const,
};

// ── Query Options ────────────────────────────────────────────────────────────

export const projectTasksQueryOptions = (projectId: string, cycleId?: string) =>
  queryOptions({
    queryKey: taskKeys.project(projectId, cycleId),
    queryFn: () => TaskService.getProjectTasks(projectId, cycleId),
    enabled: !!projectId,
  });

export const workspaceTasksQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: taskKeys.workspace(workspaceId),
    queryFn: () => TaskService.getWorkspaceTasks(workspaceId),
    enabled: !!workspaceId,
  });

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useProjectTasks = (projectId: string, cycleId?: string) =>
  useQuery(projectTasksQueryOptions(projectId, cycleId));

export const useWorkspaceTasks = (workspaceId: string) =>
  useQuery(workspaceTasksQueryOptions(workspaceId));

export const useTaskCycles = (projectId: string) =>
  useQuery({
    queryKey: ["cycles", projectId],
    queryFn: () => TaskService.getProjectCycles(projectId),
    enabled: !!projectId,
  });

// ── Mutation Hooks ───────────────────────────────────────────────────────────

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: TaskService.create,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create task");
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-task"],
    mutationFn: TaskService.update,
    onMutate: async (newValues) => {
      if (!newValues.projectId) return;
      await queryClient.cancelQueries({ queryKey: ["tasks", newValues.projectId] });
      const previousQueries = queryClient.getQueriesData<ProjectTasksData>({
        queryKey: ["tasks", newValues.projectId],
      });

      const {
        taskId,
        projectId,
        assigneeId,
        cycleId,
        parentTaskId,
        checklists,
        ...optimisticFields
      } = newValues;

      queryClient.setQueriesData<ProjectTasksData>(
        { queryKey: ["tasks", newValues.projectId] },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            tasks: old.tasks.map((task) =>
              task._id === taskId
                ? {
                    ...task,
                    ...optimisticFields,
                    dueDate:
                      optimisticFields.dueDate !== undefined
                        ? optimisticFields.dueDate
                        : task.dueDate,
                    startDate:
                      optimisticFields.startDate !== undefined
                        ? optimisticFields.startDate
                        : task.startDate,
                    priority:
                      optimisticFields.priority !== undefined
                        ? optimisticFields.priority
                        : task.priority,
                    labels:
                      optimisticFields.labels !== undefined
                        ? optimisticFields.labels
                        : task.labels,
                    completed:
                      optimisticFields.completed !== undefined
                        ? optimisticFields.completed
                        : task.completed,
                  }
                : task,
            ),
          };
        },
      );

      return { previousQueries };
    },
    onError: (error: any, newValues, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error?.message || "Failed to update task");
    },
    onSettled: (_, __, variables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId?: string }) =>
      TaskService.delete(taskId),
    onSuccess: (_, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete task");
    },
  });
};

export const useDuplicateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: TaskService.duplicate,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to duplicate task");
    },
  });
};

export const useBulkUpdateTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: TaskService.bulkUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update tasks");
    },
  });
};

export const useCreateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: TaskService.createColumn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create column");
    },
  });
};

export const useUpdateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: TaskService.updateColumn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update column");
    },
  });
};

export const useDeleteColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId }: { columnId: string; projectId?: string }) =>
      TaskService.deleteColumn(columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete column");
    },
  });
};

export const useUploadAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, formData }: { taskId: string; formData: FormData; projectId?: string }) =>
      TaskService.uploadAttachment(taskId, formData),
    onSuccess: (_, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to upload attachment");
    },
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, attachmentId }: { taskId: string; attachmentId: string; projectId?: string }) =>
      TaskService.deleteAttachment(taskId, attachmentId),
    onSuccess: (_, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete attachment");
    },
  });
};

export const useTaskComments = (taskId: string) =>
  useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn: () => TaskService.getComments(taskId),
    enabled: !!taskId,
  });

export const useAddComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string; projectId?: string }) =>
      TaskService.addComment(taskId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(variables.taskId) });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to add comment");
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string; projectId?: string }) =>
      TaskService.deleteComment(taskId, commentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(variables.taskId) });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete comment");
    },
  });
};

export const useTaskActivityLogs = (taskId: string) =>
  useQuery({
    queryKey: taskKeys.activity(taskId),
    queryFn: () => TaskService.getActivityLogs(taskId),
    enabled: !!taskId,
  });
