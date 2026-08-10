import React, { useState, useMemo } from "react";
import { useLabelsQuery } from '@/features/workspaces/projects/project-id/tasks';
import { useCreateLabel, useUpdateLabel, useDeleteLabel, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '@/features/workspaces/projects/project-id/tasks/services/label.services';
import { useParams } from 'next/navigation';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ChevronLeft, X, Search, Check, SquarePen } from "lucide-react";

interface ManageLabelsSectionProps {
  selectedLabels?: string[];
  onToggleLabel?: (labelId: string) => void;
  onClose?: () => void;
  type?: string;
  projectId?: string;
}

export default function ManageLabelsSection({ 
  selectedLabels = [],
  onToggleLabel,
  onClose,
  type = "sticky",
  projectId: propProjectId
}: ManageLabelsSectionProps) {
  const { workspaceId, projectId: routeProjectId } = useParams() as { workspaceId: string, projectId: string };
  const projectId = propProjectId !== undefined ? propProjectId : routeProjectId;

  const { data: labels = [] } = useLabelsQuery(workspaceId!, type, projectId);

  const createMutation = useCreateLabel();
  const updateMutation = useUpdateLabel();
  const deleteMutation = useDeleteLabel();

  const [view, setView] = useState<"list" | "edit">("list");
  const [labelSearch, setLabelSearch] = useState("");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_LABEL_COLOR);

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const filteredLabels = useMemo(() => {
    return (labels as any[]).filter((l: any) => l.name.toLowerCase().includes(labelSearch.toLowerCase()));
  }, [labels, labelSearch]);

  const toggleLabel = (labelId: string) => {
    onToggleLabel?.(labelId);
  };

  const handleCreateNew = () => {
    setEditingLabelId(null);
    setEditingName("");
    setSelectedColor(DEFAULT_LABEL_COLOR);
    setView("edit");
  };

  const handleEdit = (label: any) => {
    setEditingLabelId(label._id);
    setEditingName(label.name);
    setSelectedColor(label.color || DEFAULT_LABEL_COLOR);
    setView("edit");
  };

  const handleSave = () => {
    if (!editingName.trim()) return;

    if (editingLabelId) {
      updateMutation.mutate({ labelId: editingLabelId, name: editingName, color: selectedColor }, {
        onSuccess: () => setView("list")
      });
    } else {
      createMutation.mutate({ workspaceId: workspaceId!, name: editingName, color: selectedColor, type, projectId }, {
        onSuccess: () => setView("list")
      });
    }
  };

  const handleDelete = () => {
    if (editingLabelId) {
      deleteMutation.mutate(editingLabelId, {
        onSuccess: () => {
          if (selectedLabels.includes(editingLabelId)) {
            toggleLabel(editingLabelId);
          }
          setView("list");
        }
      });
    }
  };

  if (view === "edit") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setView("list")} disabled={isMutating}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold text-center flex-1">
            {editingLabelId ? "Edit label" : "Create label"}
          </span>
          {onClose && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onClose} disabled={isMutating}>
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              disabled={isMutating}
            />
          </div>

          <div className="space-y-3">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_LABEL_COLORS.map((item: any) => (
                <button
                  key={item.color}
                  onClick={() => setSelectedColor(item.color)}
                  disabled={isMutating}
                  className="h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                  style={{ backgroundColor: item.color }}
                >
                  {selectedColor === item.color && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border/50 bg-white p-3">
          <Button onClick={handleSave} disabled={isMutating || !editingName.trim()}>Save</Button>
          {editingLabelId && (
            <Button onClick={handleDelete} variant="destructive" disabled={isMutating}>Delete</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <span className="text-sm font-semibold text-center flex-1">Labels</span>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="shrink-0 bg-white px-4 pb-2 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input 
            placeholder="Search labels..." 
            value={labelSearch} 
            onChange={(e) => setLabelSearch(e.target.value)} 
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="space-y-2">
          {filteredLabels.map((label: any) => (
            <div key={label._id} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-3">
              <Checkbox 
                checked={selectedLabels.includes(label._id)} 
                onCheckedChange={() => toggleLabel(label._id)}
              />
              <button
                type="button"
                onClick={() => toggleLabel(label._id)}
                className="flex h-10 min-w-0 items-center rounded-md px-3"
                style={{ backgroundColor: label.color }}
              >
                <span className="min-w-0 max-w-full truncate text-xs font-bold text-white">
                  {label.name}
                </span>
              </button>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(label)} className="size-8">
                <SquarePen className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/30 px-2 pb-3 pt-2">
        <Button variant="secondary" onClick={handleCreateNew} className="w-full">Create a new label</Button>
      </div>
    </div>
  );
}
