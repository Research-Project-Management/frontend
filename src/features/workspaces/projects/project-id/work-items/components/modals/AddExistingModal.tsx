'use client';

import React, { useState, useMemo } from "react";
import { Button } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui";
import {
  Search,
  X,
  Plus,
} from "lucide-react";
import { useProjectTasks, useAddExistingTasksToCycle } from "../../hooks/use-tasks";
import { DetailModal as TaskDialog } from "./DetailModal";
import type { Task, Column } from "../../types/types";
import { cn } from "@/shared/lib/utils";

export interface AddExistingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentCycleId: string;
  currentCycleName?: string;
  columns?: Column[];
  members?: any[];
  onSuccess?: () => void;
}

export type AddExistingTaskModalProps = AddExistingModalProps;

export function AddExistingModal({
  open,
  onOpenChange,
  projectId,
  currentCycleId,
  currentCycleName = "this cycle",
  columns = [],
  members = [],
  onSuccess,
}: AddExistingTaskModalProps) {
  const { data, isLoading } = useProjectTasks(projectId);
  const { addTasks, isPending } = useAddExistingTasksToCycle(projectId, currentCycleId);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    
    const resolveCycleId = (task: Task) =>
      (typeof task.cycle === 'object' && task.cycle !== null ? (task.cycle as { id: string }).id : null) || (typeof task.cycleId === 'string' ? task.cycleId : null) || (typeof task.cycle === 'string' ? task.cycle : null);

    const filtered = data.tasks.filter((task: Task) => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(keyword) ||
        task.identifier?.toLowerCase().includes(keyword);
      const taskCycleId = resolveCycleId(task);
      const notInCurrentCycle = taskCycleId !== currentCycleId;
      return matchesSearch && notInCurrentCycle;
    });

    return [...filtered].sort((a: Task, b: Task) => {
      const aCycleId = resolveCycleId(a);
      const bCycleId = resolveCycleId(b);
      const aHasCycle = !!aCycleId;
      const bHasCycle = !!bCycleId;
      if (!aHasCycle && bHasCycle) return -1;
      if (aHasCycle && !bHasCycle) return 1;
      return 0;
    });
  }, [data?.tasks, searchTerm, currentCycleId]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTasks.map((t) => t.id));
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
    await addTasks({
      selectedIds,
      onSuccess: () => {
        onOpenChange(false);
        setSelectedIds([]);
        onSuccess?.();
      },
    });
  };

  const isAllSelected =
    filteredTasks.length > 0 && selectedIds.length === filteredTasks.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border border-border bg-background rounded-lg">
          {/* Header */}
          <DialogHeader className="px-6 py-5 border-b border-border bg-background text-left">
            <DialogTitle className="flex items-center gap-2 text-foreground font-semibold text-base">
              <Plus className="size-4.5 text-primary shrink-0" />
              <span>Add Existing Work Items to Cycle</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Select work items from the project to include in{" "}
              <span className="font-semibold text-foreground">{currentCycleName}</span>.
            </DialogDescription>
          </DialogHeader>

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
                aria-label="Search work items"
                className="w-full h-full text-xs bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="text-foreground cursor-pointer"
                >
                  <X className="size-3 shrink-0" />
                </button>
              )}
            </div>

            {/* Task list */}
            <div className="border border-border rounded-sm overflow-hidden bg-background">
              <div className="px-3 py-2 border-b border-border bg-muted flex items-center justify-between">
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

              <div className="max-h-60 overflow-y-auto divide-y divide-border">
                {isLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Loading project work items...
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No available work items found to add.
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleToggleSelect(task.id)}
                        className={cn(
                          "px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(task.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {task.title}
                          </p>
                          {task.identifier && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {task.identifier}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-foreground"
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
          <div className="px-6 py-3 border-t border-border bg-background flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddTasks}
              disabled={selectedIds.length === 0 || isPending}
              className="text-xs font-semibold"
            >
              {isPending ? "Adding..." : "Add to Cycle"}
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

export const AddExistingTaskModal = AddExistingModal;
export default AddExistingModal;
