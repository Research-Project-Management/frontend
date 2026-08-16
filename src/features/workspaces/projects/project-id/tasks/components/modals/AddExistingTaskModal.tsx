'use client';

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  Checkbox,
  Button,
} from "@/shared/components/ui";
import {
  Search,
  FolderKanban,
  X,
} from "lucide-react";
import { useProjectTasks, useBulkUpdateTasks } from "../../hooks/use-task";
import { TaskDetailModal as TaskDialog } from "./task/TaskDetailModal";
import type { Task, Column } from "../../types/task.types";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";

export interface AddExistingTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentCycleId: string;
  columns?: Column[];
  members?: any[];
  onSuccess?: () => void;
}

export function AddExistingTaskModal({
  open,
  onOpenChange,
  projectId,
  currentCycleId,
  columns = [],
  members = [],
  onSuccess,
}: AddExistingTaskModalProps) {
  const { data, isLoading } = useProjectTasks(projectId);
  const bulkUpdateMutation = useBulkUpdateTasks();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    
    const filtered = data.tasks.filter((task: Task) => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(keyword) ||
        task.identifier?.toLowerCase().includes(keyword);
      const notInCurrentCycle =
        typeof task.cycleId === "string"
          ? task.cycleId !== currentCycleId
          : task.cycleId?._id !== currentCycleId;
      return matchesSearch && notInCurrentCycle;
    });

    return [...filtered].sort((a: Task, b: Task) => {
      const aHasCycle = !!a.cycleId;
      const bHasCycle = !!b.cycleId;
      if (!aHasCycle && bHasCycle) return -1;
      if (aHasCycle && !bHasCycle) return 1;
      return 0;
    });
  }, [data?.tasks, searchTerm, currentCycleId]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTasks.map((t) => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAddTasks = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one task to add");
      return;
    }

    try {
      await bulkUpdateMutation.mutateAsync({
        taskIds: selectedIds,
        data: { cycleId: currentCycleId },
        projectId,
      });

      toast.success(`Successfully added ${selectedIds.length} tasks to cycle`);
      onOpenChange(false);
      setSelectedIds([]);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to add tasks to cycle");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-border bg-background shadow-2xl rounded-sm">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2 text-foreground font-semibold text-base">
              <FolderKanban className="size-4.5 text-primary" />
              <span>Add Existing Tasks to Cycle</span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">
              Select tasks from this project to include in the current cycle.
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Search */}
            <div className="relative flex items-center h-9 rounded-sm border border-border bg-background px-3 focus-within:border-primary transition-colors">
              <Search className="size-3.5 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search by title or identifier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-full text-xs bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Task list */}
            <div className="border border-border rounded-sm overflow-hidden bg-background">
              <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      filteredTasks.length > 0 &&
                      selectedIds.length === filteredTasks.length
                    }
                    onCheckedChange={handleSelectAll}
                    id="select-all-add"
                  />
                  <label
                    htmlFor="select-all-add"
                    className="text-xs font-semibold text-muted-foreground cursor-pointer"
                  >
                    Select All ({filteredTasks.length})
                  </label>
                </div>
                <span className="text-xs font-medium text-primary">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-border/60">
                {isLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Loading project tasks...
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No available tasks found to add.
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedIds.includes(task._id);
                    return (
                      <div
                        key={task._id}
                        onClick={() => handleToggleSelect(task._id)}
                        className={cn(
                          "px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(task._id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {task.title}
                          </p>
                          {task.identifier && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {task.identifier}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailTask(task);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={bulkUpdateMutation.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddTasks}
              disabled={selectedIds.length === 0 || bulkUpdateMutation.isPending}
              className="text-xs font-semibold"
            >
              {bulkUpdateMutation.isPending ? "Adding..." : "Add to Cycle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Preview Dialog */}
      {detailTask && (
        <TaskDialog
          open={!!detailTask}
          onOpenChange={(v) => !v && setDetailTask(null)}
          card={detailTask}
          columns={columns}
          members={members}
          onSave={() => {}}
          isReadOnly={true}
        />
      )}
    </>
  );
}

export default AddExistingTaskModal;
