import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Cycle } from "~/types/task";
import { API_URL } from "~/lib/api";

// Fetch cycles for a project
export const fetchProjectCycles = async (projectId: string) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/cycles`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch cycles");
  return response.json() as Promise<{ cycles: Cycle[] }>;
};

export const useProjectCycles = (projectId: string) => {
  return useQuery({
    queryKey: ["cycles", projectId],
    queryFn: () => fetchProjectCycles(projectId),
    enabled: !!projectId,
  });
};

// Create cycle
export const useCreateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      ...data
    }: { projectId: string } & Partial<Cycle>) => {
      const response = await fetch(
        `${API_URL}/api/project/${projectId}/cycles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw new Error("Failed to create cycle");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cycles", variables.projectId],
      });
    },
  });
};

// Update cycle
export const useUpdateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cycleId,
      projectId,
      ...data
    }: { cycleId: string; projectId: string } & Partial<Cycle>) => {
      const response = await fetch(`${API_URL}/api/cycles/${cycleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update cycle");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cycles", variables.projectId],
      });
    },
  });
};

// Delete cycle
export const useDeleteCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cycleId,
      projectId,
    }: {
      cycleId: string;
      projectId: string;
    }) => {
      const response = await fetch(`${API_URL}/api/cycles/${cycleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete cycle");
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cycles", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
    },
  });
};
