import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Search, X, Check, ChevronRight } from "lucide-react";
import { useProjectTasks, useUpdateTask } from "~/query/task";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { TaskDialog } from "../task_dialog/CardDetail";
import type { Column, Task } from "~/types/task";

interface AddExistingTaskModalProps {
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
  const updateTaskMutation = useUpdateTask();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter((task) => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(keyword) ||
                          task.identifier?.toLowerCase().includes(keyword);
      // Filter out tasks already in the current cycle
      const notInCurrentCycle = task.cycle?._id !== currentCycleId;
      return matchesSearch && notInCurrentCycle;
    });
  }, [data?.tasks, searchTerm, currentCycleId]);

  const allFilteredSelected = useMemo(() => {
    if (filteredTasks.length === 0) return false;
    return filteredTasks.every((t) => selectedIds.includes(t._id));
  }, [filteredTasks, selectedIds]);

  const handleToggleTask = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredTasks.map(t => t._id));
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredTasks.map(t => t._id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(
        selectedIds.map((taskId) =>
          updateTaskMutation.mutateAsync({
            taskId,
            projectId,
            cycle: currentCycleId,
          })
        )
      );
      toast.success(`Successfully added ${selectedIds.length} tasks to cycle`);
      onOpenChange(false);
      setSelectedIds([]);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to add some tasks");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        setSelectedIds([]);
        setSearchTerm("");
      }
      onOpenChange(val);
    }}>
      <DialogContent className="w-145 max-w-[90vw] overflow-hidden rounded-sm border border-zinc-200 p-0 shadow-2xl bg-white" showCloseButton={false}>
        {/* Search bar */}
        <div className="px-2 pt-6 pb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-4 size-5 text-zinc-700" strokeWidth={2.25} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search"
              autoFocus
              className="h-10 w-full pl-13 pr-3 text-[18px] font-medium text-zinc-900 outline-none transition-colors placeholder:font-normal placeholder:text-zinc-500 focus:border-zinc-300"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 px-5 py-2">
            {selectedIds.map((taskId) => {
              const task = data?.tasks.find((t) => t._id === taskId);
              if (!task) return null;
              return (
                <button
                  key={taskId}
                  type="button"
                  onClick={() => handleToggleTask(taskId)}
                  className="group inline-flex items-center gap-1.5 rounded-sm border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-50"
                >
                  <span className="max-w-45 truncate">{task.title}</span>
                  <X className="size-3 text-zinc-400 group-hover:text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}

        {/* Task list */}
        <div className="max-h-80 overflow-y-auto px-1 py-2 custom-scrollbar min-h-[150px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
               <span className="text-[13px] text-muted-foreground animate-pulse">Loading tasks...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-300">
              <Search className="size-8 mb-2 opacity-10" strokeWidth={1.5} />
              <p className="text-[13px] font-medium">No tasks found</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const checked = selectedIds.includes(task._id);
              const otherCycle = task.cycle;

              return (
                <div key={task._id} className="px-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task._id)}
                    className="group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-[#091e420f]"
                  >
                    <Checkbox
                      checked={checked}
                      className="size-4 shrink-0 rounded-[2px] border-zinc-300 bg-white data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
                    />
                    <div className="flex flex-1 items-center gap-2.5 min-w-0">
                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-2 min-w-0">
                           {(() => {
                             const col = columns.find(c => c.id === task.columnId || c._id?.toString() === task.columnId);
                             if (!col) return null;
                             return (
                               <span className="shrink-0 text-[11px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-[2px] truncate max-w-[80px]">
                                 {col.title}
                               </span>
                             );
                           })()}
                           <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">
                             {task.title}
                           </span>
                         </div>
                         {otherCycle && (
                           <span className="text-[10px] text-zinc-400 font-medium ml-[calc(var(--col-width,0px)+8px)]">
                             Currently in: {otherCycle.name}
                           </span>
                         )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailTask(task as Task);
                      }}
                      className="inline-flex size-7 items-center justify-center rounded-sm text-zinc-300 hover:bg-zinc-200/50 hover:text-zinc-600 transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-1 flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={filteredTasks.length === 0}
            className="h-8 rounded-sm px-2 text-[12px] font-semibold text-[#44546f] transition-colors hover:bg-[#091e420f] disabled:opacity-30"
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3 text-[#44546f] hover:bg-[#091e420f] text-[13px] font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || updateTaskMutation.isPending}
              className="h-9 min-w-17.5 bg-black px-4 text-white shadow-none hover:bg-black/90 disabled:opacity-30 text-[13px] font-medium rounded-sm"
            >
              {updateTaskMutation.isPending ? "..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {detailTask && (
        <TaskDialog
          open={!!detailTask}
          onOpenChange={(open) => !open && setDetailTask(null)}
          card={detailTask}
          columns={columns}
          members={members}
          onSave={() => {}}
          onDelete={() => {}}
          onDuplicate={() => {}}
        />
      )}
    </Dialog>
  );
}
