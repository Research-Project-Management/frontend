import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/shared/constants/query-keys";
import { getStickies, createSticky, updateSticky, deleteSticky, reorderStickies } from "../services/sticky.service";
import type { Sticky } from "../types/sticky.types";

export const useSticky = (projectId: string, search?: string) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.stickies.projectList(projectId, search);
  const invalidateKey = queryKeys.stickies.all;

  const query = useQuery({
    queryKey,
    queryFn: () => getStickies(projectId, search),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (variables: {
      projectId: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
    }) => createSticky(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success("Sticky added", { id: "sticky-action-project" });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err?.message || "Failed to add sticky", {
        id: "sticky-action-project",
      }),
  });

  const update = useMutation({
    mutationFn: (variables: { stickyId: string; updates: Partial<Sticky> }) =>
      updateSticky(variables.stickyId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.map((sticky) =>
          sticky._id === variables.stickyId || sticky.id === variables.stickyId
            ? { ...sticky, ...variables.updates }
            : sticky
        );
      });
      return { previous };
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Update failed", {
        id: "sticky-action-project",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const remove = useMutation({
    mutationFn: deleteSticky,
    onMutate: async (stickyId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.filter((sticky) => sticky._id !== stickyId && sticky.id !== stickyId);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Sticky deleted", { id: "sticky-action-project" });
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete sticky", {
        id: "sticky-action-project",
      });
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
        const mapped = new Map(old.map((sticky) => [sticky._id || sticky.id, sticky]));
        return stickyIds.map((id: string) => mapped.get(id)).filter(Boolean) as Sticky[];
      });
      return { previous };
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Reorder failed", {
        id: "sticky-action-project",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return { query, mutations: { create, update, remove, reorder } };
};
