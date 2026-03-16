import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Cycle } from "~/types/task";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProjectCycles = (projectId: string) =>
  apiGet<{ cycles: Cycle[] }>(`/api/project/${projectId}/cycles`);

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProjectCycles = (projectId: string) =>
  useQuery({
    queryKey: ["cycles", projectId],
    queryFn: () => fetchProjectCycles(projectId),
    enabled: !!projectId,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<Cycle>) =>
      apiPost(`/api/project/${projectId}/cycles`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cycles", variables.projectId] });
    },
  });
};

export const useUpdateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, projectId, ...data }: { cycleId: string; projectId: string } & Partial<Cycle>) =>
      apiPut(`/api/cycles/${cycleId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cycles", variables.projectId] });
    },
  });
};

export const useDeleteCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId }: { cycleId: string; projectId: string }) =>
      apiDelete(`/api/cycles/${cycleId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cycles", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};
