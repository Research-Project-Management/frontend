import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/shared/constants/query-keys";
import { getStickies, createSticky, updateSticky, deleteSticky, reorderStickies } from "../services/sticky.services";
import type { Sticky } from "../types/sticky.types";

export const useSticky = (workspaceId: string, search?: string, projectId?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const fullQueryKey = queryKeys.stickies.workspaceList(workspaceId, search, projectId);
  const invalidateKey = queryKeys.stickies.all;

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => getStickies(workspaceId, search, projectId),
    enabled: (options?.enabled ?? true) && !!workspaceId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: createSticky,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success("Sticky added", { id: "sticky-action" });
    },
    onError: () => toast.error("Failed to add sticky", { id: "sticky-action" }),
  });

  const update = useMutation({
    mutationFn: (variables: { stickyId: string; updates: Partial<Sticky> }) =>
      updateSticky(variables.stickyId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData(fullQueryKey);
      queryClient.setQueryData(fullQueryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.map((sticky) => (sticky._id === variables.stickyId ? { ...sticky, ...variables.updates } : sticky));
      });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error("Update failed", { id: "sticky-action" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const remove = useMutation({
    mutationFn: deleteSticky,
    onMutate: async (stickyId) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData(fullQueryKey);
      queryClient.setQueryData(fullQueryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.filter((sticky) => sticky._id !== stickyId);
      });
      toast.success("Sticky deleted", { id: "sticky-action" });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error("Failed to delete", { id: "sticky-action" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const reorder = useMutation({
    mutationFn: (stickyIds: string[]) => reorderStickies(workspaceId, stickyIds),
    onMutate: async (stickyIds) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData(fullQueryKey);
      queryClient.setQueryData(fullQueryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        const mapped = new Map(old.map((sticky) => [sticky._id, sticky]));
        return stickyIds.map((id: string) => mapped.get(id)).filter(Boolean) as Sticky[];
      });
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error("Reorder failed", { id: "sticky-action" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return { query, mutations: { create, update, remove, reorder } };
};
