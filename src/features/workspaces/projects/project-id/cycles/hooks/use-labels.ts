'use client';

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { CycleLabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR, type CycleLabel } from "../services/label.services";

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

// ── Query Keys ───────────────────────────────────────────────────────────────

export const cycleLabelKeys = {
  all: ["labels"] as const,
  list: (workspaceId: string, type: string = "cycle", projectId?: string) =>
    ["labels", workspaceId, type, projectId] as const,
};

// ── Query Options ────────────────────────────────────────────────────────────

export const cycleLabelsQueryOptions = (workspaceId: string, type: string = "cycle", projectId?: string) =>
  queryOptions({
    queryKey: cycleLabelKeys.list(workspaceId, type, projectId),
    queryFn: () => CycleLabelService.list(workspaceId, type, projectId),
    enabled: !!workspaceId,
    staleTime: 0,
  });

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useLabelsQuery = (workspaceId: string, type: string = "cycle", projectId?: string) =>
  useQuery(cycleLabelsQueryOptions(workspaceId, type, projectId));

// ── Mutation Hooks ───────────────────────────────────────────────────────────

export const useCreateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: CycleLabelService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      toast.success("Label created");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create label");
    },
  });
};

export const useUpdateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: CycleLabelService.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      toast.success("Label updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update label");
    },
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: CycleLabelService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      toast.success("Label deleted");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete label");
    },
  });
};

// ── Interactive Label Management Hook ────────────────────────────────────────

export type LabelView = "list" | "edit";

export const useLabels = (workspaceId: string, type: string = "cycle", projectId?: string) => {
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
    return (workspaceLabels as CycleLabel[]).filter((label) =>
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
