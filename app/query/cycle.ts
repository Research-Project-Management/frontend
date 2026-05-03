import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Cycle } from "~/types/task";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProjectCycles = (projectId: string) =>
  apiGet<{ cycles: Cycle[] }>(`/api/project/${projectId}/cycles`);

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProjectCycles = (projectId: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;

    const onCreated = ({ cycle }: { cycle: Cycle }) => {
      queryClient.setQueryData<{ cycles: Cycle[] }>(["cycles", projectId], (old) => {
        if (!old) return old;
        if (old.cycles.some((c) => c._id === cycle._id)) return old;
        return { ...old, cycles: [...old.cycles, cycle] };
      });
    };

    const onUpdated = ({ cycle }: { cycle: Cycle }) => {
      queryClient.setQueryData<{ cycles: Cycle[] }>(["cycles", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cycles: old.cycles.map((c) => (c._id === cycle._id ? cycle : c)),
        };
      });
    };

    const onDeleted = ({ cycleId }: { cycleId: string }) => {
      queryClient.setQueryData<{ cycles: Cycle[] }>(["cycles", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cycles: old.cycles.filter((c) => c._id !== cycleId),
        };
      });
    };

    socket.on("cycle:created", onCreated);
    socket.on("cycle:updated", onUpdated);
    socket.on("cycle:deleted", onDeleted);

    return () => {
      socket.off("cycle:created", onCreated);
      socket.off("cycle:updated", onUpdated);
      socket.off("cycle:deleted", onDeleted);
    };
  }, [socket, projectId, queryClient]);

  return useQuery({
    queryKey: ["cycles", projectId],
    queryFn: () => fetchProjectCycles(projectId),
    enabled: !!projectId,
  });
};

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
