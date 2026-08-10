'use client';

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, Column, TaskMutationInput } from "@/features/workspaces/projects/project-id/tasks/types/task.types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";

import { toast } from "sonner";

export type TaskActivityLog = any;
export type Cycle = any;
export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
  projectName: string;
  cycles: Cycle[];
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProjectTasks = (projectId: string, cycleId?: string) =>
  apiGet<ProjectTasksData>(`/api/project/${projectId}/tasks${cycleId ? `?cycle=${cycleId}` : ""}`);

export const fetchWorkspaceTasks = async (workspaceId: string) => {
  const response = await apiGet<{ data: Task[] }>(`/api/workspace/${workspaceId}/tasks`);
  return response.data;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProjectTasks = (projectId: string, cycleId?: string) => {
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["tasks", projectId, cycleId],
    queryFn: () => fetchProjectTasks(projectId, cycleId),
    enabled: !!projectId,
  });
};

export const useWorkspaceTasks = (workspaceId: string) =>
  useQuery({
    queryKey: ["workspace-tasks", workspaceId],
    queryFn: () => fetchWorkspaceTasks(workspaceId),
    enabled: !!workspaceId,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & TaskMutationInput) =>
      apiPost(`/api/project/${projectId}/tasks`, data),
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
    mutationFn: ({ taskId, projectId, ...data }: { taskId: string; projectId: string } & TaskMutationInput) =>
      apiPut(`/api/tasks/${taskId}`, data),
    onMutate: async (newValues) => {
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
                      optimisticFields.dueDate === null
                        ? null
                        : optimisticFields.dueDate,
                    startDate:
                      (optimisticFields as any).startDate === null
                        ? null
                        : (optimisticFields as any).startDate,
                    endDate:
                      (optimisticFields as any).endDate === null
                        ? null
                        : (optimisticFields as any).endDate,
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
      // Suppress the toast if it's the redundant "read-only" message already shown in the banner
      if (error?.message !== "Completed cycles are read-only." && error?.response?.data?.message !== "Completed cycles are read-only.") {
        toast.error(error?.message || error?.response?.data?.message || "Failed to update task");
      }
    },
    onSettled: (_, _err, variables) => {
      if (queryClient.isMutating({ mutationKey: ["update-task"] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

export const useBulkUpdateTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskIds, data }: { projectId: string; taskIds: string[]; data: any }) =>
      apiPut(`/api/project/${projectId}/tasks/bulk`, { taskIds, data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update tasks");
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) =>
      apiDelete(`/api/tasks/${taskId}`),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", variables.projectId] });
      const previousData = queryClient.getQueryData<ProjectTasksData>(["tasks", variables.projectId]);
      if (previousData) {
        queryClient.setQueryData<ProjectTasksData>(["tasks", variables.projectId], {
          ...previousData,
          tasks: previousData.tasks.filter((t) => t._id !== variables.taskId),
        });
      }
      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["tasks", variables.projectId], context.previousData);
      }
    },
    onSettled: (_, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

export const useDuplicateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
      apiPost<{ task: Task }>(`/api/tasks/${taskId}/duplicate`, {}),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

export const useCreateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<Column>) =>
      apiPost(`/api/project/${projectId}/columns`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create column");
    },
  });
};

export const useDeleteColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, columnId }: { projectId: string; columnId: string }) =>
      apiDelete(`/api/project/${projectId}/columns/${columnId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete column");
    },
  });
};

export const useUpdateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, columnId, ...data }: { projectId: string; columnId: string } & Partial<Column>) =>
      apiPut(`/api/project/${projectId}/columns/${columnId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update column");
    },
  });
};

// ── Task Client Utils ────────────────────────────────────────────────────────

export type TaskAttachment = Task["attachments"][number];

export function resolveTaskAssigneeId(value: Task["assigneeId"] | string | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "object" ? value._id : value;
}

export function createTaskAttachmentFromUpload(file: File, url: string): TaskAttachment {
  return {
    id: Math.random().toString(36).slice(2, 11),
    name: file.name,
    type: file.type,
    size: `${Math.round(file.size / 1024)}KB`,
    createdAt: new Date().toISOString(),
    url,
  };
}

// ── Task Comment Types ───────────────────────────────────────────────────────

type TaskCommentAuthor = {
  _id: string;
  name: string;
  avatar?: string;
};

type TaskCommentReply = {
  _id: string;
  author: TaskCommentAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  _id: string;
  task: string;
  project: string;
  author: TaskCommentAuthor;
  content: string;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canReply: boolean;
  };
  reactions?: Array<{
    user: string;
    emoji: string;
  }>;
  currentUserReaction?: string;
  replies: Array<
    TaskCommentReply & {
      permissions?: {
        canDelete: boolean;
      };
    }
  >;
  createdAt: string;
  updatedAt: string;
};

// ── Task Comment Queries ─────────────────────────────────────────────────────

export const useTaskComments = (taskId: string | null) => {
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const data = await apiGet<{ comments: TaskComment[] }>(`/api/tasks/${taskId}/comments`);
      return data.comments;
    },
    enabled: !!taskId,
  });
};

export const useTaskCommentCount = (taskId: string | null) => {
  return useQuery({
    queryKey: ["task-comment-count", taskId],
    queryFn: async () => {
      const data = await apiGet<{ count: number }>(`/api/tasks/${taskId}/comments/count`);
      return data.count;
    },
    enabled: !!taskId,
  });
};

export const useCreateTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      apiPost<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments`, { content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create comment");
    },
  });
};

export const useUpdateTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId, content }: { taskId: string; commentId: string; content: string }) =>
      apiPut<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments/${commentId}`, { content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update comment");
    },
  });
};

export const useDeleteTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      apiDelete(`/api/tasks/${taskId}/comments/${commentId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete comment");
    },
  });
};

export const useAddTaskCommentReply = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId, content }: { taskId: string; commentId: string; content: string }) =>
      apiPost<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments/${commentId}/replies`, { content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
  });
};

export const useDeleteTaskCommentReply = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId, replyId }: { taskId: string; commentId: string; replyId: string }) =>
      apiDelete(`/api/tasks/${taskId}/comments/${commentId}/replies/${replyId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
  });
};

export const useReactTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId, emoji }: { taskId: string; commentId: string; emoji?: string }) =>
      apiPut<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments/${commentId}/reaction`, {
        emoji: emoji || "",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update reaction");
    },
  });
};

// ── Task Activity Queries ──────────────────────────────────────────────────────

export const useTaskActivity = (taskId: string | null) => {
  const queryClient = useQueryClient();


  return useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const data = await apiGet<{ activity: TaskActivityLog[] }>(`/api/tasks/${taskId}/activity`);
      return data.activity;
    },
    enabled: !!taskId,
  });
};
