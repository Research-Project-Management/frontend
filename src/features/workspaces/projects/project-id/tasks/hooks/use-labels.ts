'use client';

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from "../services/label.services";
import type { Label, CreateLabelInput, UpdateLabelInput } from "../types/label.types";

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

// ── Query Keys ───────────────────────────────────────────────────────────────

export const labelKeys = {
  all: ["labels"] as const,
  list: (workspaceId: string, type?: string, projectId?: string) =>
    ["labels", workspaceId, type, projectId] as const,
};

// ── Query Options ────────────────────────────────────────────────────────────

export const labelsQueryOptions = (workspaceId: string, type?: string, projectId?: string) =>
  queryOptions({
    queryKey: labelKeys.list(workspaceId, type, projectId),
    queryFn: () => LabelService.list(workspaceId, type, projectId),
    enabled: !!workspaceId,
    staleTime: 0,
  });

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useLabelsQuery = (workspaceId: string, type?: string, projectId?: string) =>
  useQuery(labelsQueryOptions(workspaceId, type, projectId));

// ── Mutation Hooks ───────────────────────────────────────────────────────────

export const useCreateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: LabelService.create,
    onMutate: async (newLabel) => {
      await queryClient.cancelQueries({ queryKey: ["labels"] });
      const previousLabels = queryClient.getQueryData(["labels"]);

      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        const optimisticLabel = {
          _id: "temp-id-" + Math.random(),
          ...newLabel,
          createdAt: new Date().toISOString(),
        };
        if (!Array.isArray(old)) return [optimisticLabel];
        return [...old, optimisticLabel];
      });

      return { previousLabels };
    },
    onError: (error: any, _, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error?.message || "Failed to create label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};

export const useUpdateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: LabelService.update,
    onMutate: async (updatedLabel) => {
      await queryClient.cancelQueries({ queryKey: ["labels"] });
      const previousLabels = queryClient.getQueryData(["labels"]);

      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((label: any) =>
          label._id === updatedLabel.labelId
            ? { ...label, ...updatedLabel }
            : label,
        );
      });

      return { previousLabels };
    },
    onError: (error: any, _, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error?.message || "Failed to update label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: LabelService.delete,
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ["labels"] });
      const previousLabels = queryClient.getQueryData(["labels"]);

      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((label: any) => label._id !== labelId);
      });

      return { previousLabels };
    },
    onError: (error: any, _, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error?.message || "Failed to delete label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};

// ── Interactive Label Management Hook ────────────────────────────────────────

export type LabelView = "list" | "edit";

export const useLabels = (workspaceId: string, type: string, projectId?: string) => {
  const queryClient = useQueryClient();
  const { data: workspaceLabels = [], isLoading } = useLabelsQuery(workspaceId, type, projectId);

  const createMutation = useCreateLabel();
  const updateMutation = useUpdateLabel();
  const deleteMutation = useDeleteLabel();

  const [view, setView] = useState<LabelView>("list");
  const [labelSearch, setLabelSearch] = useState("");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_LABEL_COLOR);

  const filteredLabels = useMemo(() => {
    return workspaceLabels.filter((label: any) =>
      label.name.toLowerCase().includes(labelSearch.toLowerCase()),
    );
  }, [workspaceLabels, labelSearch]);

  const handleCreateNew = () => {
    setEditingLabelId(null);
    setEditingName("");
    setSelectedColor(DEFAULT_LABEL_COLOR);
    setView("edit");
  };

  const handleEdit = (label: { _id: string; name: string; color: string }) => {
    setEditingLabelId(label._id);
    setEditingName(label.name);
    setSelectedColor(label.color);
    setView("edit");
  };

  const handleSave = async (onSuccessExtra?: (labelId: string) => void) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    if (editingLabelId) {
      updateMutation.mutate(
        {
          labelId: editingLabelId,
          name: trimmed,
          color: selectedColor,
        },
        {
          onSuccess: () => {
            setView("list");
            queryClient.invalidateQueries({ queryKey: ["labels"] });
            toast.success("Label updated");
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          workspaceId,
          name: trimmed,
          color: selectedColor,
          type,
          projectId,
        },
        {
          onSuccess: (data) => {
            setView("list");
            queryClient.invalidateQueries({ queryKey: ["labels"] });
            const createdLabel = data.label ?? data.tag;
            if (createdLabel?._id) onSuccessExtra?.(createdLabel._id);
            toast.success("Label created");
          },
        },
      );
    }
  };

  const handleDelete = async (onDeleteExtra?: (labelId: string) => void) => {
    if (!editingLabelId) return;

    deleteMutation.mutate(editingLabelId, {
      onSuccess: () => {
        setView("list");
        queryClient.invalidateQueries({ queryKey: ["labels"] });
        onDeleteExtra?.(editingLabelId);
        toast.success("Label deleted");
      },
    });
  };

  return {
    workspaceLabels,
    filteredLabels,
    isLoading,
    view,
    setView,
    labelSearch,
    setLabelSearch,
    editingLabelId,
    editingName,
    setEditingName,
    selectedColor,
    setSelectedColor,
    handleCreateNew,
    handleEdit,
    handleSave,
    handleDelete,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
