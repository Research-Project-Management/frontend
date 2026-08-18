'use client';

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Button,
} from "@/shared/components/ui";
import {
  Search,
  ArrowRightLeft,
  PlayCircle,
  CircleDashed,
  X,
} from "lucide-react";
import { useBulkUpdateTasks } from "../../hooks/use-task";
import { TaskDetailModal as TaskDialog } from "./task/TaskDetailModal";
import type { Task, Column, Cycle } from "../../types/task.types";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";

export interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sourceCycleId: string;
  sourceCycleName: string;
  tasks: Task[];
  availableCycles: Cycle[];
  columns: Column[];
  members?: any[];
  onSuccess?: () => void;
}

export function TransferModal({
  open,
  onOpenChange,
  projectId,
  sourceCycleId,
  sourceCycleName,
  tasks,
  availableCycles,
  columns,
  members = [],
  onSuccess,
}: TransferModalProps) {
  const bulkUpdateMutation = useBulkUpdateTasks();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [targetCycleId, setTargetCycleId] = useState<string>("");

  const filteredTasks = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(keyword) ||
        task.identifier?.toLowerCase().includes(keyword)
      );
    });
  }, [tasks, searchTerm]);

  const targetCycles = useMemo(() => {
    return availableCycles.filter(
      (c) => c.id !== sourceCycleId && c.status !== "completed"
    );
  }, [availableCycles, sourceCycleId]);

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

  const handleTransfer = async () => {
    if (!targetCycleId) {
      toast.error("Please select a destination cycle");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Please select at least one task to transfer");
      return;
    }

    try {
      await bulkUpdateMutation.mutateAsync({
        taskIds: selectedIds,
        data: { cycleId: targetCycleId === "unassigned" ? null : targetCycleId },
        projectId,
      });

      toast.success(`Successfully transferred ${selectedIds.length} tasks`);
      onOpenChange(false);
      setSelectedIds([]);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to transfer tasks");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-border bg-background shadow-2xl rounded-sm">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2 text-foreground font-semibold text-base">
              <ArrowRightLeft className="size-4.5 text-primary" />
              <span>Transfer Tasks from Cycle</span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">
              Select tasks to move from{" "}
              <span className="font-semibold text-foreground">{sourceCycleName}</span> to another cycle.
            </p>
          </div>

          {/* Controls */}
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
                Destination Cycle
              </label>
              <Select value={targetCycleId} onValueChange={setTargetCycleId}>
                <SelectTrigger className="w-full h-9 rounded-sm border-border bg-background text-sm">
                  <SelectValue placeholder="Select target cycle..." />
                </SelectTrigger>
                <SelectContent className="rounded-sm border-border">
                  <SelectItem value="unassigned" className="cursor-pointer">
                    <span className="text-muted-foreground font-medium">Remove from Cycle (Unassign)</span>
                  </SelectItem>
                  {targetCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        {cycle.status === "active" ? (
                          <PlayCircle className="size-3.5 text-emerald-500" />
                        ) : (
                          <CircleDashed className="size-3.5 text-muted-foreground" />
                        )}
                        <span>{cycle.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative flex items-center h-9 rounded-sm border border-border bg-background px-3 focus-within:border-primary transition-colors">
              <Search className="size-3.5 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search tasks to transfer..."
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
                    id="select-all"
                  />
                  <label
                    htmlFor="select-all"
                    className="text-xs font-semibold text-muted-foreground cursor-pointer"
                  >
                    Select All ({filteredTasks.length})
                  </label>
                </div>
                <span className="text-xs font-medium text-primary">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                {filteredTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No tasks found matching criteria.
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleToggleSelect(task.id)}
                        className={cn(
                          "px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors",
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
              onClick={handleTransfer}
              disabled={
                !targetCycleId ||
                selectedIds.length === 0 ||
                bulkUpdateMutation.isPending
              }
              className="text-xs font-semibold"
            >
              {bulkUpdateMutation.isPending ? "Transferring..." : "Transfer Tasks"}
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

export default TransferModal;
