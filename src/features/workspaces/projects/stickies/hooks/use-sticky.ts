import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { stickyKeys } from "../constants/sticky.keys";
import { useWorkspace } from "@/features/workspaces/shell/hooks/use-workspace";
import { getStickies, createSticky, updateSticky, deleteSticky, reorderStickies } from "../services/sticky.service";
import type { Sticky } from "../types/sticky.types";

export const useSticky = (workspaceId: string, search?: string, projectId?: string, options?: { enabled?: boolean }) => {
  const { workspace } = useWorkspace(workspaceId);
  const effectiveWorkspaceId = workspace?.id || workspaceId;
  const queryClient = useQueryClient();
  const fullQueryKey = stickyKeys.workspaceList(effectiveWorkspaceId, search, projectId);
  const invalidateKey = stickyKeys.all;

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => getStickies(effectiveWorkspaceId, search, projectId),
    enabled: (options?.enabled ?? true) && !!effectiveWorkspaceId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (variables: {
      workspaceId: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
    }) =>
      createSticky({
        ...variables,
        workspaceId: effectiveWorkspaceId || variables.workspaceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success("Sticky added", { id: "sticky-action" });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err?.message || "Failed to add sticky", {
        id: "sticky-action",
      }),
  });

  const update = useMutation({
    mutationFn: (variables: { stickyId: string; updates: Partial<Sticky> }) =>
      updateSticky(variables.stickyId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData(fullQueryKey);
      queryClient.setQueryData(fullQueryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.map((sticky) =>
          sticky.id === variables.stickyId
            ? { ...sticky, ...variables.updates }
            : sticky
        );
      });
      return { previous };
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Update failed", {
        id: "sticky-action",
      });
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
        return old.filter((sticky) => sticky.id !== stickyId);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Sticky deleted", { id: "sticky-action" });
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete sticky", {
        id: "sticky-action",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const reorder = useMutation({
    mutationFn: (stickyIds: string[]) => reorderStickies(effectiveWorkspaceId, stickyIds),
    onMutate: async (stickyIds) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData(fullQueryKey);
      queryClient.setQueryData(fullQueryKey, (old: Sticky[] | undefined) => {
        if (!old) return old;
        const mapped = new Map(old.map((sticky) => [sticky.id, sticky]));
        return stickyIds.map((id: string) => mapped.get(id)).filter(Boolean) as Sticky[];
      });
      return { previous };
    },
    onError: (err: any, _, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(err?.response?.data?.message || err?.message || "Reorder failed", {
        id: "sticky-action",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  return { query, mutations: { create, update, remove, reorder } };
};
