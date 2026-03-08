import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, Column } from "../types/task";
import { API_URL } from "~/lib/api";

export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
};

// Fetch Tasks and Columns
export const fetchProjectTasks = async (projectId: string) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/tasks`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json() as Promise<ProjectTasksData>;
};

export const useProjectTasks = (projectId: string) => {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => fetchProjectTasks(projectId),
    enabled: !!projectId,
  });
};

// Fetch Workspace Tasks (user's tasks)
export const fetchWorkspaceTasks = async (workspaceId: string) => {
  const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/tasks`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch workspace tasks");
  const data = await response.json();
  return data.tasks as Task[];
};

export const useWorkspaceTasks = (workspaceId: string) => {
  return useQuery({
    queryKey: ["workspace-tasks", workspaceId],
    queryFn: () => fetchWorkspaceTasks(workspaceId),
    enabled: !!workspaceId,
  });
};

// Create Task
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...data }: { projectId: string } & Partial<Task>) => {
      const response = await fetch(`${API_URL}/api/project/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create task");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

// Update Task
export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId, ...data }: { taskId: string, projectId: string } & Partial<Task>) => {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    // Optimistic Update logic
    onMutate: async (newValues) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ["tasks", newValues.projectId] });

        // Snapshot the previous value
        const previousData = queryClient.getQueryData<ProjectTasksData>(["tasks", newValues.projectId]);

        // Optimistically update to the new value
        if (previousData) {
            queryClient.setQueryData<ProjectTasksData>(["tasks", newValues.projectId], {
                ...previousData,
                tasks: previousData.tasks.map(task => 
                    task._id === newValues.taskId 
                        ? { ...task, ...newValues } 
                        : task
                )
            });
        }

        // Return a context object with the snapshotted value
        return { previousData };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newValues, context) => {
        if (context?.previousData) {
            queryClient.setQueryData(["tasks", newValues.projectId], context.previousData);
        }
    },
    // Always refetch after error or success:
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

// Delete Task
export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: string, projectId: string }) => {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete task");
      return true;
    },
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ["tasks", variables.projectId] });
        const previousData = queryClient.getQueryData<ProjectTasksData>(["tasks", variables.projectId]);
        if (previousData) {
            queryClient.setQueryData<ProjectTasksData>(["tasks", variables.projectId], {
                ...previousData,
                tasks: previousData.tasks.filter(t => t._id !== variables.taskId)
            });
        }
        return { previousData };
    },
    onError: (err, variables, context) => {
        if (context?.previousData) {
            queryClient.setQueryData(["tasks", variables.projectId], context.previousData);
        }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
    },
  });
};

// Create Column
export const useCreateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...data }: { projectId: string } & Partial<Column>) => {
      const response = await fetch(`${API_URL}/api/project/${projectId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create column");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};
