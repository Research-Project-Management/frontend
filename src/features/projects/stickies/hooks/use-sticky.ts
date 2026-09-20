import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { stickyKeys } from "../constants/sticky.keys";
import {
  getStickies,
  createSticky,
  updateSticky,
  deleteSticky,
  reorderStickies,
} from "../services/sticky.service";
import type { Sticky } from "../types/sticky.types";
import { uuidv7 } from "../utils/sticky.utils";

export const useSticky = (
  options?: { enabled?: boolean },
) => {
  const queryClient = useQueryClient();
  const fullQueryKey = stickyKeys.list();

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => getStickies(),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: (variables?: {
      id?: string;
      title?: string;
      content?: string;
      color?: string;
      position?: { x: number; y: number };
    }) => {
      const payload = {
        ...variables,
        id: variables?.id || uuidv7(),
      };
      return createSticky(payload);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData<Sticky[]>(fullQueryKey);

      // 1. Optimistic UI: Client-generated UUID v7 for 0ms instant display without key thrashing
      const stickyId = variables?.id || uuidv7();
      if (variables && !variables.id) {
        variables.id = stickyId;
      }

      const optimisticSticky: Sticky = {
        id: stickyId,
        title: variables?.title || '',
        content: variables?.content || '<p></p>',
        color: (variables?.color as any) || 'yellow-1',
        position: variables?.position || { x: 0, y: 0 },
        order: previous ? previous.length : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => [
        ...old,
        optimisticSticky,
      ]);

      return { previous, stickyId };
    },
    onSuccess: (serverSticky, _variables, context) => {
      // 2. Backend SSOT Reconcile: Update item with authoritative fields (sanitized HTML, order, server timestamps)
      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => {
        return old.map((s) => (s.id === context?.stickyId || s.id === serverSticky.id ? serverSticky : s));
      });
      toast.success("Sticky added", { id: "sticky-action" });
    },
    onError: (err: any, _variables, context) => {
      // 3. Rollback: If backend rejects (e.g. 422 empty draft note), revert to previous snapshot
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to add sticky",
        { id: "sticky-action" },
      );
    },
  });

  const update = useMutation({
    mutationFn: (variables: { stickyId: string; updates: Partial<Sticky> }) =>
      updateSticky(variables.stickyId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData<Sticky[]>(fullQueryKey);

      // Optimistic patch for zero-latency editing experience
      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => {
        return old.map((sticky) =>
          sticky.id === variables.stickyId
            ? {
                ...sticky,
                ...variables.updates,
                updatedAt: new Date().toISOString(),
              }
            : sticky,
        );
      });
      return { previous };
    },
    onSuccess: (serverSticky) => {
      // Backend SSOT Reconcile: apply server-sanitized HTML and canonical updatedAt without invalidating queries
      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => {
        return old.map((sticky) =>
          sticky.id === serverSticky.id ? serverSticky : sticky,
        );
      });
    },
    onError: (err: any, _variables, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(
        err?.response?.data?.message || err?.message || "Update failed",
        { id: "sticky-action" },
      );
    },
  });

  const remove = useMutation({
    mutationFn: deleteSticky,
    onMutate: async (stickyId) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData<Sticky[]>(fullQueryKey);
      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => {
        return old.filter((sticky) => sticky.id !== stickyId);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Sticky deleted", { id: "sticky-action" });
    },
    onError: (err: any, _variables, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete sticky",
        { id: "sticky-action" },
      );
    },
  });

  const reorder = useMutation({
    mutationFn: (stickyIds: string[]) => reorderStickies(stickyIds),
    onMutate: async (stickyIds) => {
      await queryClient.cancelQueries({ queryKey: fullQueryKey });
      const previous = queryClient.getQueryData<Sticky[]>(fullQueryKey);
      queryClient.setQueryData<Sticky[]>(fullQueryKey, (old = []) => {
        const mapped = new Map(old.map((sticky) => [sticky.id, sticky]));
        return stickyIds.map((id: string) => mapped.get(id)).filter(Boolean) as Sticky[];
      });
      return { previous };
    },
    onSuccess: (res) => {
      // Backend SSOT Reconcile: update cache with canonical sorted indices from server
      if (res?.stickies && res.stickies.length > 0) {
        queryClient.setQueryData<Sticky[]>(fullQueryKey, res.stickies);
      }
    },
    onError: (err: any, _variables, context) => {
      queryClient.setQueryData(fullQueryKey, context?.previous);
      toast.error(
        err?.response?.data?.message || err?.message || "Reorder failed",
        { id: "sticky-action" },
      );
    },
  });

  return { query, mutations: { create, update, remove, reorder } };
};
