import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, Column } from "../types/task";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";

export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
  projectName: string;
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProjectTasks = (projectId: string) =>
  apiGet<ProjectTasksData>(`/api/project/${projectId}/tasks`);

export const fetchWorkspaceTasks = async (workspaceId: string) => {
  const data = await apiGet<{ tasks: Task[] }>(`/api/workspace/${workspaceId}/tasks`);
  return data.tasks;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProjectTasks = (projectId: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit("join:project", projectId);

    const onCreated = ({ task }: { task: Task }) => {
      queryClient.setQueryData<ProjectTasksData>(["tasks", projectId], (old) => {
        if (!old) return old;
        if (old.tasks.some((t) => t._id === task._id)) return old;
        return { ...old, tasks: [...old.tasks, task] };
      });
    };
    const onUpdated = ({ task }: { task: Task }) => {
      queryClient.setQueryData<ProjectTasksData>(["tasks", projectId], (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.map((t) => (t._id === task._id ? task : t)) };
      });
    };
    const onDeleted = ({ taskId }: { taskId: string }) => {
      queryClient.setQueryData<ProjectTasksData>(["tasks", projectId], (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t._id !== taskId) };
      });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    };
    const onColumnCreated = ({ columns }: { columns: Column[] }) => {
      queryClient.setQueryData<ProjectTasksData>(["tasks", projectId], (old) => {
        if (!old) return old;
        return { ...old, columns };
      });
    };

    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:deleted", onDeleted);
    socket.on("column:created", onColumnCreated);

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("task:created", onCreated);
      socket.off("task:updated", onUpdated);
      socket.off("task:deleted", onDeleted);
      socket.off("column:created", onColumnCreated);
    };
  }, [socket, projectId, queryClient]);

  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => fetchProjectTasks(projectId),
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
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<Task>) =>
      apiPost(`/api/project/${projectId}/tasks`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, projectId, ...data }: { taskId: string; projectId: string } & Partial<Task>) =>
      apiPut(`/api/tasks/${taskId}`, data),
    onMutate: async (newValues) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", newValues.projectId] });
      const previousData = queryClient.getQueryData<ProjectTasksData>(["tasks", newValues.projectId]);
      if (previousData) {
        queryClient.setQueryData<ProjectTasksData>(["tasks", newValues.projectId], {
          ...previousData,
          tasks: previousData.tasks.map((task) =>
            task._id === newValues.taskId ? { ...task, ...newValues } : task,
          ),
        });
      }
      return { previousData };
    },
    onError: (_err, newValues, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["tasks", newValues.projectId], context.previousData);
      }
    },
    onSettled: (_, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
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

export const useCreateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<Column>) =>
      apiPost(`/api/project/${projectId}/columns`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};
