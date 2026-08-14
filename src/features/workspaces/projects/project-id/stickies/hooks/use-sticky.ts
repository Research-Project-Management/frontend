import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/shared/constants/query-keys";
import { getStickies, createSticky, updateSticky, deleteSticky, reorderStickies } from "../services/sticky.services";
import type { Sticky } from "../types/sticky.types";

export const useSticky = (projectId: string, search?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.stickies.projectList(projectId, search);
  const invalidateKey = queryKeys.stickies.all;

  const query = useQuery({
    queryKey,
    queryFn: () => getStickies(projectId, search),
    enabled: (options?.enabled ?? true) && !!projectId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: createSticky,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success("Sticky added", { id: "sticky-action-project" });
    },
    onError: () => toast.error("Failed to add sticky", { id: "sticky-action-project" }),
  });

  const update = useMutation({
    mutationFn: (variables: { stickyId: string; updates: Partial<Sticky> }) =>
      updateSticky(variables.stickyId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.map((sticky) => (sticky._id === variables.stickyId ? { ...sticky, ...variables.updates } : sticky));
      });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Update failed", { id: "sticky-action-project" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const remove = useMutation({
    mutationFn: (stickyId: string) => deleteSticky(stickyId),
    onMutate: async (stickyId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.filter((sticky) => sticky._id !== stickyId);
      });
      toast.success("Sticky deleted", { id: "sticky-action-project" });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Failed to delete", { id: "sticky-action-project" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const reorder = useMutation({
    mutationFn: (stickyIds: string[]) => reorderStickies(projectId, stickyIds),
    onMutate: async (stickyIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        const mapped = new Map(old.map((sticky) => [sticky._id, sticky]));
        return stickyIds.map((id: string) => mapped.get(id)).filter(Boolean) as Sticky[];
      });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Reorder failed", { id: "sticky-action-project" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return { query, mutations: { create, update, remove, reorder } };
};
