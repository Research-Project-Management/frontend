import { useState, useMemo } from "react";
import { useLabelsQuery, useCreateLabel, useUpdateLabel, useDeleteLabel, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from "~/query/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
    return workspaceLabels.filter((label) =>
      label.name.toLowerCase().includes(labelSearch.toLowerCase())
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
      updateMutation.mutate({
        labelId: editingLabelId,
        name: trimmed,
        color: selectedColor,
      }, {
        onSuccess: () => {
          setView("list");
          queryClient.invalidateQueries({ queryKey: ["labels"] });
          toast.success("Label updated");
        }
      });
    } else {
      createMutation.mutate({
        workspaceId,
        name: trimmed,
        color: selectedColor,
        type,
        projectId,
      }, {
        onSuccess: (data) => {
          setView("list");
          queryClient.invalidateQueries({ queryKey: ["labels"] });
          const createdLabel = data.label ?? data.tag;
          if (createdLabel?._id) onSuccessExtra?.(createdLabel._id);
          toast.success("Label created");
        }
      });
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
      }
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
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  };
};
