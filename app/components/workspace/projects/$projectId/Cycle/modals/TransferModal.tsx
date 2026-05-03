import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Search, ArrowRightLeft, FolderKanban, PlayCircle, CircleDashed, AlertCircle, X, ChevronRight } from "lucide-react";
import { useBulkUpdateTasks } from "~/query/task";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { TaskDialog } from "../../Task/task_dialog/CardDetail";
import type { Column, Task, Cycle } from "~/types/task";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface TransferModalProps {
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
      const matchesSearch = task.title.toLowerCase().includes(keyword) ||
                          task.identifier?.toLowerCase().includes(keyword);
      return matchesSearch;
    });
  }, [tasks, searchTerm]);

  const targetCycles = useMemo(() => {
    return availableCycles.filter(c => c._id !== sourceCycleId && c.status !== "completed");
  }, [availableCycles, sourceCycleId]);

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

  const resetState = () => {
    setSelectedIds([]);
    setSearchTerm("");
    setTargetCycleId("");
  };



  const handleExecuteTransfer = async () => {
    try {
      await bulkUpdateMutation.mutateAsync({
        projectId,
        taskIds: selectedIds,
        data: {
          cycle: targetCycleId
        }
      });
      
      const targetName = targetCycles.find(c => c._id === targetCycleId)?.name || "new cycle";
      toast.success(`Successfully transferred ${selectedIds.length} tasks to ${targetName}`);
      onOpenChange(false);
      resetState();
      onSuccess?.();
    } catch (error) {
      // toast.error handled by mutation
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}>
        <DialogContent className="w-130 max-w-[90vw] overflow-hidden rounded-sm border border-zinc-200 p-0 shadow-2xl bg-white" showCloseButton={false}>
          <div className="flex flex-col max-h-[80vh]">
            {/* Header / Target Cycle Selector */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-100 bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <Select value={targetCycleId} onValueChange={setTargetCycleId}>
                  <SelectTrigger className="h-8 w-auto min-w-30 max-w-[160px] rounded-sm border-0 bg-zinc-100 px-3 text-[13px] font-semibold text-zinc-900 shadow-none hover:bg-zinc-200 focus:ring-0 transition-colors">
                    <div className="truncate text-left flex-1">
                      <SelectValue placeholder="Target Cycle" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-zinc-200 shadow-xl p-1">
                    {targetCycles.map((cycle) => (
                      <SelectItem key={cycle._id} value={cycle._id} className="py-2.5 focus:bg-zinc-100 rounded-sm">
                        <div className="flex items-center gap-2">
                          {cycle.status === "active" ? (
                            <PlayCircle className="size-3.5 text-orange-500" />
                          ) : (
                            <CircleDashed className="size-3.5 text-blue-500" />
                          )}
                          <span className="text-[13px] font-semibold">{cycle.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {targetCycles.length === 0 && (
                      <div className="p-4 text-center text-zinc-400 italic text-[12px]">
                        No cycles available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                
                <h2 className="text-[14px] font-bold text-zinc-900 tracking-tight">Transfer tasks</h2>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onOpenChange(false)}
                className="size-9 rounded-sm text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
              >
                <X className="size-5" />
              </Button>
            </div>

            {/* Search bar */}
            <div className="px-2 pt-4 pb-2">
              <div className="relative flex items-center">
                <Search className="absolute left-4 size-5 text-zinc-700" strokeWidth={2.25} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search"
                  autoFocus
                  className="h-10 w-full pl-13 pr-3 text-[18px] font-medium text-zinc-900 outline-none transition-colors placeholder:font-normal placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selectedIds.length > 0 && (
              <div className="mt-1 flex min-h-9 flex-wrap items-center gap-2 px-5 py-2">
                {selectedIds.map((taskId) => {
                  const task = tasks.find((t) => t._id === taskId);
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

            {/* Task List */}
            <div className="flex-1 overflow-y-auto px-1 py-2 custom-scrollbar min-h-[200px] max-h-[320px]">
               {filteredTasks.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-300">
                   <FolderKanban className="size-8 mb-2 opacity-10" strokeWidth={1.5} />
                   <p className="text-[13px] font-medium">No tasks found</p>
                 </div>
               ) : (
                 filteredTasks.map((task) => {
                    const isChecked = selectedIds.includes(task._id);
                    const col = columns.find(c => c.id === task.columnId || c._id?.toString() === task.columnId);
                    
                    return (
                      <div key={task._id} className="px-2">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task._id)}
                          className="group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-[#091e420f]"
                        >
                          <Checkbox
                            checked={isChecked}
                            className="size-4 shrink-0 rounded-[2px] border-zinc-300 bg-white data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
                          />
                          <div className="flex flex-1 items-center gap-2.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                               {col && (
                                 <span className="shrink-0 text-[11px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-[2px] truncate max-w-[100px]">
                                   {col.title}
                                 </span>
                               )}
                               <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">
                                 {task.title}
                               </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailTask(task);
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
            <div className="mt-1 flex items-center justify-end px-6 py-4 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-3 text-[#44546f] hover:bg-[#091e420f] text-[13px] font-medium"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleExecuteTransfer}
                  disabled={selectedIds.length === 0 || !targetCycleId || bulkUpdateMutation.isPending}
                  className="h-9 min-w-17.5 bg-black px-4 text-white shadow-none hover:bg-black/90 disabled:opacity-30 text-[13px] font-medium rounded-sm"
                >
                  {bulkUpdateMutation.isPending ? "Transferring..." : "Transfer"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
    </>
  );
}
