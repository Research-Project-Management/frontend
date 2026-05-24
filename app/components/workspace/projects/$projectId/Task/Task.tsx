import { useState, useMemo } from "react";
import { useParams } from "react-router";
import TopBar from "./TopBar";
import Topbar from "../overview/Topbar";
import BoardView from "./views/BoardView";
import ListView from "./views/ListView";
import CalendarView from "./views/CalendarView";
import { TaskDialog } from "./task_dialog/CardDetail";
import CreateModal, { type SectionData } from "./modals/CreateModal";
import DeleteModal from "./modals/DeleteModal";
import { AddExistingTaskModal } from "./modals/AddExistingTaskModal";
import { TransferModal } from "../Cycle/modals/TransferModal";
import {
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useCreateColumn,
  useDeleteTask,
  useDuplicateTask,
  useDeleteColumn,
  useUpdateColumn,
} from "~/query/task";
import { useLabelsQuery } from "~/query/label";
import { useProjectDetails } from "~/query/project";
import { useProjectCycles } from "~/query/cycle";
import { useProjects } from "~/hooks/useWorkspace";
import { useDocumentTitle } from "~/hooks";
import type {
  Task as TaskType,
  Column,
  TaskMutationInput,
} from "~/types/task";
import { resolveTaskColumnId } from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { KanbanSquare, ChevronDown, Check, Search, ChevronRight, RotateCcw, Plus, Info, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useNavigate } from "react-router";
import { cn } from "~/lib/utils";

type ViewMode = "board" | "list" | "calendar";
type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

export default function Task({ cycleId, isReadOnly }: { cycleId?: string, isReadOnly?: boolean }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { workspaceId, projectId } = useParams();
  const { data, isLoading } = useProjectTasks(projectId!, cycleId);
  const { data: projectData } = useProjectDetails(projectId!);
  const { data: cyclesData } = useProjectCycles(projectId!);
  const { data: taskLabels = [] } = useLabelsQuery(workspaceId || "", "task", projectId);
  const currentCycle = cyclesData?.cycles.find(c => c._id === cycleId);

  const pageTitle = cycleId && currentCycle
    ? `${currentCycle.name} - ${projectData?.project?.name || "Project"}`
    : `Tasks${projectData?.project?.name ? ` - ${projectData.project.name}` : ""}`;

  useDocumentTitle(pageTitle);

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const duplicateTaskMutation = useDuplicateTask();
  const createColumnMutation = useCreateColumn();
  const deleteColumnMutation = useDeleteColumn();
  const updateColumnMutation = useUpdateColumn();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCard, setDialogCard] = useState<Partial<TaskType>>({});
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null);

  // Column Modals state
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);
  const [sectionModalMode, setSectionModalMode] = useState<"create" | "edit">("create");
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [cycleSearchTerm, setCycleSearchTerm] = useState("");

  const allTasks = data?.tasks ?? [];
  const columns = data?.columns ?? [];
  const members = projectData?.members ?? [];
  const assigneeFilterOptions = useMemo<AssigneeFilterOption[]>(() => {
    const byId = new Map<string, AssigneeFilterOption>();
    let hasUnassignedTask = false;

    for (const task of allTasks) {
      if (task.assignee?._id) {
        byId.set(task.assignee._id, {
          id: task.assignee._id,
          name: task.assignee.name,
          avatar: task.assignee.avatar,
        });
      } else {
        hasUnassignedTask = true;
      }
    }

    const options = Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );

    if (hasUnassignedTask) {
      options.push({ id: "__unassigned__", name: "Unassigned" });
    }

    return options;
  }, [allTasks]);

  const tasks = useMemo(() => {
    if (selectedColumnIds.length === 0 && selectedAssigneeIds.length === 0) {
      return allTasks;
    }
    
    return allTasks.filter((t) => {
      if (selectedColumnIds.length > 0 && !selectedColumnIds.includes(t.columnId)) return false;
      if (selectedAssigneeIds.length > 0) {
        const assigneeId = t.assignee?._id ?? "__unassigned__";
        if (!selectedAssigneeIds.includes(assigneeId)) return false;
      }
      return true;
    });
  }, [allTasks, selectedColumnIds, selectedAssigneeIds]);

  const tasksByColumnId = useMemo(() => {
    const grouped = new Map<string, TaskType[]>();
    const validColumnIds = new Set(columns.map(c => resolveTaskColumnId(c)));
    const firstColumnId = validColumnIds.size > 0 ? Array.from(validColumnIds)[0] : null;

    for (const task of tasks) {
      let targetColumnId = task.columnId;
      
      // If task has no column or invalid column, move it to the first column for visibility
      if (!targetColumnId || !validColumnIds.has(targetColumnId)) {
        if (firstColumnId) {
          targetColumnId = firstColumnId;
        }
      }

      if (targetColumnId) {
        if (!grouped.has(targetColumnId)) {
          grouped.set(targetColumnId, []);
        }
        grouped.get(targetColumnId)!.push(task);
      }
    }

    return grouped;
  }, [tasks, columns]);

  const taskLabelMap = useMemo(() => {
    return new Map(
      taskLabels.map((label) => [
        label._id,
        { _id: label._id, name: label.name, color: label.color },
      ]),
    );
  }, [taskLabels]);

  const hasActiveTaskFilters = Boolean(
    selectedColumnIds.length > 0 || selectedAssigneeIds.length > 0
  );

  const visibleColumns = useMemo(() => {
    if (selectedColumnIds.length > 0) {
      return columns.filter((column) =>
        selectedColumnIds.includes(resolveTaskColumnId(column)),
      );
    }

    if (!hasActiveTaskFilters) {
      return columns;
    }

    const taskColumnIds = new Set(tasks.map((task) => task.columnId));
    return columns.filter((column) =>
      taskColumnIds.has(resolveTaskColumnId(column)),
    );
  }, [columns, selectedColumnIds, hasActiveTaskFilters, tasks]);

  /* Handlers */
  const handleOpenAddDialog = (
    columnId: string,
    title?: string,
    dueDate?: string,
  ) => {
    const quickTitle = title?.trim();

    if (quickTitle) {
      if (createTaskMutation.isPending) return;
      
      createTaskMutation.mutate({
        projectId: projectId!,
        columnId,
        title: quickTitle,
        dueDate,
        cycle: cycleId,
        assignee: null,
      }, {
        onSuccess: () => {
          toast.success(cycleId ? "Task added to cycle" : "Task created");
        }
      });
      return;
    }

    setDialogCard({
      columnId,
      title: title?.trim() || "",
      dueDate,
      cycle: cycleId as any,
      assignee: null,
    });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (card: TaskType) => {
    setDialogCard(card);
    setDialogOpen(true);
  };

  const handleMoveCard = (taskId: string, newColumnId: string) => {
    updateTaskMutation.mutate({
      taskId,
      projectId: projectId!,
      columnId: newColumnId,
    });
  };

  const handleToggleCardCompleted = (card: TaskType) => {
    updateTaskMutation.mutate({
      taskId: card._id,
      projectId: projectId!,
      completed: !card.completed,
    });
  };

  const handleSaveCard = (cardData: TaskMutationInput) => {
    if (dialogCard._id) {
      updateTaskMutation.mutate(
        {
          taskId: dialogCard._id,
          projectId: projectId!,
          ...cardData,
        },
      );
      return;
    }

    createTaskMutation.mutate(
      {
        projectId: projectId!,
        cycle: cycleId,
        ...cardData,
      },
      {
        onSuccess: (result: any) => {
          toast.success(cycleId ? "Task added to cycle" : "Task created");
          if (result?.task?._id) {
            setDialogCard(result.task);
            return;
          }

          setDialogCard({});
        },
      },
    );
  };

  const closeTaskDeleteModal = () => {
    setDeletingTask(null);
  };

  const handleDeleteCard = () => {
    if (dialogCard._id) {
      setDeletingTask(dialogCard as TaskType);
    }
  };

  const closeSectionModal = () => {
    setIsSectionModalOpen(false);
    setEditingColumn(null);
    setSectionModalMode("create");
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingColumn(null);
  };

  const findColumn = (id: string) =>
    columns.find((column) => resolveTaskColumnId(column) === id);

  const handleOpenAddSectionModal = () => {
    setEditingColumn(null);
    setSectionModalMode("create");
    setIsSectionModalOpen(true);
  };

  const handleCreateSection = (payload: SectionData): void => {
    createColumnMutation.mutate(
      {
        projectId: projectId!,
        title: payload.sectionName,
        accentColor: payload.selectedColor,
      },
      {
        onSuccess: () => {
          toast.success("Column created");
          closeSectionModal();
        },
      },
    );
  };

  const handleUpdateColumn = (columnId: string, title: string, accentColor?: string) => {
    updateColumnMutation.mutate(
      { projectId: projectId!, columnId, title, accentColor },
      {
        onSuccess: () => {
          toast.success("Column updated");
          closeSectionModal();
        },
      },
    );
  };

  const handleOpenRenameModal = (columnId: string) => {
    const col = findColumn(columnId);
    if (col) {
      setEditingColumn(col);
      setSectionModalMode("edit");
      setIsSectionModalOpen(true);
    }
  };

  const handleOpenDeleteModal = (columnId: string) => {
    const col = findColumn(columnId);
    if (col) {
      setDeletingColumn(col);
      setIsDeleteModalOpen(true);
    }
  };

  const handleColumnDeleteConfirm = () => {
    if (deletingColumn) {
      const colId = deletingColumn._id ?? deletingColumn.id ?? "";
      deleteColumnMutation.mutate(
        { projectId: projectId!, columnId: colId },
        {
          onSuccess: () => {
            toast.success("Column deleted");
            closeDeleteModal();
          },
        },
      );
    }
  };

  const handleDeleteCardFromMenu = (card: TaskType) => {
    setDeletingTask(card);
  };

  const handleTaskDeleteConfirm = () => {
    if (deletingTask?._id) {
      deleteTaskMutation.mutate(
        { taskId: deletingTask._id, projectId: projectId! },
        {
          onSuccess: () => {
            if (dialogCard._id === deletingTask._id) {
              setDialogOpen(false);
            }
            closeTaskDeleteModal();
            toast.success("Task deleted");
          },
        },
      );
    }
  };

  const handleDuplicateCard = (card: TaskType) => {
    duplicateTaskMutation.mutate(
      { projectId: projectId!, taskId: card._id },
      {
        onSuccess: () => {
          toast.success("Task duplicated");
        },
      },
    );
  };

  const handleJoinCard = (card: TaskType) => {
    if (!currentUser?._id) return;
    if (card.assignee?._id === currentUser._id) return;

    updateTaskMutation.mutate({
      taskId: card._id,
      projectId: projectId!,
      assignee: currentUser._id,
    });
  };

  const handleLeaveCard = (card: TaskType) => {
    if (!currentUser?._id) return;
    if (card.assignee?._id !== currentUser._id) return;

    updateTaskMutation.mutate({
      taskId: card._id,
      projectId: projectId!,
      assignee: null,
    });
  };

  const handleRemoveFromCycle = (card: TaskType, callback?: () => void) => {
    updateTaskMutation.mutate({
      taskId: card._id,
      projectId: projectId!,
      cycle: null,
    }, {
      onSuccess: () => {
        toast.success("Task removed from cycle");
        callback?.();
      }
    });
  };

  const handleAssignExistingTasksToDate = (
    taskIds: string[],
    dueDate: string,
    quiet = false,
    startDate?: string | null,
  ) => {
    if (taskIds.length === 0) return;

    taskIds.forEach((taskId) => {
      const payload: any = {
        taskId,
        projectId: projectId!,
        dueDate,
      };

      if (startDate !== undefined) {
        payload.startDate = startDate;
      }

      updateTaskMutation.mutate(payload);
    });

    if (!quiet) {
      toast.success(
        taskIds.length === 1
          ? "Task added to calendar"
          : `${taskIds.length} tasks added to calendar`,
      );
    }
  };


  const isCycleEmpty = cycleId && allTasks.length === 0 && !isLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
        <div className="px-4 h-13 flex items-center gap-2 border-b border-border">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 flex gap-5 p-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-72 space-y-3">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full overflow-hidden">
      <Topbar
        project={projectData?.project ? { name: projectData.project.name, avatar: projectData.project.avatar } : undefined}
        title={cycleId && currentCycle ? "Cycles" : "Tasks"}
        onTitleClick={cycleId ? () => navigate(`/${workspaceId}/projects/${projectId}/cycles`) : undefined}
        Icon={cycleId ? RotateCcw : KanbanSquare}
        count={allTasks.length}
        titleExtra={
          cycleId && currentCycle ? (
            <div className="flex items-center h-full">
              {/* Separator from "Cycles" */}
              <ChevronRight className="size-3.5 text-muted-foreground/20 ml-0.5" />
              
              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) setCycleSearchTerm("");
                }}
              >
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2.5 px-2 py-1 rounded-sm hover:bg-zinc-100/80 data-[state=open]:bg-zinc-100 cursor-pointer transition-all group ml-1">
                    <RotateCcw className="size-3.5 text-foreground/80 group-hover:text-foreground group-data-[state=open]:text-foreground transition-colors" />
                    <span className="text-[13px] font-semibold text-foreground group-hover:text-foreground group-data-[state=open]:text-foreground tracking-tight whitespace-nowrap">
                      {currentCycle.name}
                    </span>
                    {allTasks.length > 0 && (
                      <div className="px-1.5 py-0.5 rounded-sm bg-zinc-100 text-muted-foreground text-[11px] font-medium leading-none min-w-[18px] flex items-center justify-center border border-zinc-200/50 ml-0.5">
                        {allTasks.length}
                      </div>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-0 rounded-sm border border-border bg-popover shadow-xl z-[100] overflow-hidden">
                   {/* Search Box */}
                   <div className="p-2 border-b border-zinc-100 bg-zinc-50/50">
                      <div className="relative flex items-center h-8 rounded-sm border border-zinc-200 bg-white overflow-hidden focus-within:border-zinc-300 transition-colors">
                        <Search className="absolute left-2 size-3.5 text-zinc-400" />
                        <input
                          type="text"
                          value={cycleSearchTerm}
                          onChange={(e) => setCycleSearchTerm(e.target.value)}
                          placeholder="Search cycles..."
                          autoFocus
                          className="h-full w-full pl-7 pr-2 text-[12px] bg-transparent outline-none placeholder:text-zinc-400 text-zinc-700"
                          onKeyDown={(e) => e.stopPropagation()} // Prevent closing on space
                        />
                      </div>
                   </div>

                   <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                     {cyclesData?.cycles
                       .filter(c => c.name.toLowerCase().includes(cycleSearchTerm.toLowerCase()))
                       .map((cycle) => {
                         const isActive = cycle._id === cycleId;
                         return (
                           <DropdownMenuItem
                             key={cycle._id}
                             onSelect={() => {
                               navigate(`/${workspaceId}/projects/${projectId}/cycles/${cycle._id}`);
                               setCycleSearchTerm("");
                             }}
                             className={cn(
                               "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors outline-none",
                               isActive ? "bg-zinc-100/80 text-foreground font-medium" : "text-muted-foreground hover:bg-zinc-50 hover:text-foreground"
                             )}
                           >
                             <RotateCcw className={cn("size-3.5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground/40")} />
                             <span className="text-[13px] truncate flex-1">{cycle.name}</span>
                             {isActive && <Check className="size-3.5 ml-auto text-foreground/40" />}
                           </DropdownMenuItem>
                         );
                       })}
                     {cyclesData?.cycles.filter(c => c.name.toLowerCase().includes(cycleSearchTerm.toLowerCase())).length === 0 && (
                       <div className="px-3 py-4 text-center">
                         <span className="text-[12px] text-zinc-400">No cycles found</span>
                       </div>
                     )}
                   </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : undefined
        }
        actions={
          <TopBar
            viewMode={viewMode}
            onViewChange={setViewMode}
            columns={columns}
            selectedColumnIds={selectedColumnIds}
            onColumnFilterChange={setSelectedColumnIds}
            assignees={assigneeFilterOptions}
            selectedAssigneeIds={selectedAssigneeIds}
            onAssigneeFilterChange={setSelectedAssigneeIds}
            onAddTask={() => handleOpenAddDialog(resolveTaskColumnId(columns[0]))}
            onAddExistingTask={cycleId ? () => setIsAddExistingModalOpen(true) : undefined}
            isLoading={createTaskMutation.isPending}
            isReadOnly={isReadOnly}
          />
        }
      />

      {isReadOnly && cycleId && (
        <div className="flex items-center justify-between px-4 pt-4 pb-1.5 bg-white animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-2">
            <Info className="size-3.5 text-zinc-500" />
            <span className="text-[13px] text-zinc-500 font-medium">Completed cycles are not editable.</span>
          </div>
          <button 
            className="h-7 px-3 flex items-center gap-2 rounded-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-bold transition-colors active:scale-[0.98]"
            onClick={() => setIsTransferModalOpen(true)}
          >
            <ArrowRightLeft className="size-3" />
            Transfer Tasks
          </button>
        </div>
      )}

      {isCycleEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 bg-white animate-in fade-in zoom-in-95 duration-500">
           <div className="mb-8 opacity-90 scale-110">
              <svg width="220" height="130" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="70" y="20" width="80" height="50" rx="4" fill="#F4F5F7" />
                <rect x="70" y="30" width="80" height="50" rx="4" fill="#F4F5F7" stroke="#EBEDF0" />
                <rect x="70" y="40" width="80" height="50" rx="4" fill="white" stroke="#EBEDF0" />
                <circle cx="110" cy="65" r="18" stroke="#333" strokeWidth="1.5" />
                <path d="M106 65V58H114V72H106V65Z" fill="#EBEDF0" />
                <rect x="40" y="60" width="30" height="8" rx="4" fill="#F4F5F7" />
                <rect x="150" y="30" width="30" height="15" rx="4" fill="#F4F5F7" />
              </svg>
           </div>
           <h3 className="text-[15px] font-bold text-foreground mb-2 tracking-tight">
             No tasks to show in this cycle
           </h3>
           <p className="text-[13px] text-muted-foreground max-w-[440px] text-center mb-8 leading-relaxed">
             Add tasks to begin monitoring your team's progress this cycle and achieve your goals on time.
           </p>
            {!isReadOnly && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenAddDialog(resolveTaskColumnId(columns[0]))}
                  className="h-9 px-4 bg-primary text-primary-foreground rounded-sm text-[13px] font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] flex items-center gap-2"
                >
                  Add task
                </button>
                <button
                  onClick={() => setIsAddExistingModalOpen(true)}
                  className="h-9 px-4 bg-white border border-border text-foreground rounded-sm text-[13px] font-semibold hover:bg-zinc-50 transition-all active:scale-[0.98]"
                >
                  Add existing task
                </button>
              </div>
            )}
        </div>
      ) : visibleColumns.length === 0 && hasActiveTaskFilters ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold text-foreground">
              No matching columns
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try changing your search keyword or column filter to see more tasks.
            </p>
          </div>
        </div>
      ) : viewMode === "board" ? (
        <BoardView
          tasks={tasks}
          tasksByColumnId={tasksByColumnId}
          columns={visibleColumns}
          labelMap={taskLabelMap}
          currentUserId={currentUser?._id ?? null}
          currentUserAvatar={currentUser?.avatar ?? undefined}
          onAddCard={handleOpenAddDialog}
          onEditCard={handleOpenEditDialog}
          onDeleteCard={handleDeleteCardFromMenu}
          onDuplicateCard={handleDuplicateCard}
          onJoinCard={handleJoinCard}
          onLeaveCard={handleLeaveCard}
          onToggleCardCompleted={handleToggleCardCompleted}
          onMoveCard={handleMoveCard}
          onCreateColumn={handleOpenAddSectionModal}
          onDeleteColumn={handleOpenDeleteModal}
          onUpdateColumn={handleOpenRenameModal}
          onRemoveFromCycle={handleRemoveFromCycle}
          isAddingCard={createTaskMutation.isPending}
          cycleId={cycleId}
          isReadOnly={isReadOnly}
        />
      ) : viewMode === "list" ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4">
          <ListView
            projectId={projectId!}
            tasksByColumnId={tasksByColumnId}
            columns={visibleColumns}
            currentUserId={currentUser?._id ?? null}
            currentUserAvatar={currentUser?.avatar ?? undefined}
            onAddCard={handleOpenAddDialog}
            onEditCard={handleOpenEditDialog}
            onDeleteCard={handleDeleteCardFromMenu}
            onDuplicateCard={handleDuplicateCard}
            onJoinCard={handleJoinCard}
            onLeaveCard={handleLeaveCard}
            onRemoveFromCycle={handleRemoveFromCycle}
            onMoveCard={handleMoveCard}
            isAddingCard={createTaskMutation.isPending}
            isReadOnly={isReadOnly}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4">
          <CalendarView
            tasks={allTasks}
            columns={columns}
            workspaceId={workspaceId ?? ""}
            projectId={projectId ?? ""}
            onAddCard={handleOpenAddDialog}
            onOpenCardDetail={handleOpenEditDialog}
            onAssignExistingTasks={handleAssignExistingTasksToDate}
            onRemoveFromCycle={cycleId ? handleRemoveFromCycle : undefined}
            isAddingCard={createTaskMutation.isPending}
            isReadOnly={isReadOnly}
          />
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        card={dialogCard}
        columns={columns}
        members={members}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onDuplicate={() => dialogCard._id && handleDuplicateCard(dialogCard as TaskType)}
        onRemoveFromCycle={cycleId ? () => handleRemoveFromCycle(dialogCard as TaskType, () => setDialogOpen(false)) : undefined}
        isReadOnly={isReadOnly}
      />

      {/* Column Management Modals */}
      <CreateModal
        isOpen={isSectionModalOpen}
        onClose={closeSectionModal}
        onSubmit={(data) => {
          if (sectionModalMode === "create") {
            handleCreateSection(data);
          } else {
            const colId = editingColumn?._id ?? editingColumn?.id ?? "";
            handleUpdateColumn(colId, data.sectionName, data.selectedColor);
          }
        }}
        mode={sectionModalMode}
        initialData={editingColumn ? {
          sectionName: editingColumn.title,
          selectedColor: editingColumn.accentColor,
        } : undefined}
        isLoading={createColumnMutation.isPending || updateColumnMutation.isPending}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleColumnDeleteConfirm}
        title={`Delete "${deletingColumn?.title}"`}
        confirmLabel="Delete"
        isLoading={deleteColumnMutation.isPending}
      />

      <DeleteModal
        isOpen={Boolean(deletingTask)}
        onClose={closeTaskDeleteModal}
        onConfirm={handleTaskDeleteConfirm}
        title="Delete task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteTaskMutation.isPending}
      />

      {cycleId && (
        <AddExistingTaskModal
          open={isAddExistingModalOpen}
          onOpenChange={setIsAddExistingModalOpen}
          projectId={projectId!}
          currentCycleId={cycleId}
          columns={columns}
          members={members}
        />
      )}

      {cycleId && currentCycle && (
        <TransferModal
          open={isTransferModalOpen}
          onOpenChange={setIsTransferModalOpen}
          projectId={projectId!}
          sourceCycleId={cycleId}
          sourceCycleName={currentCycle.name}
          tasks={allTasks}
          availableCycles={cyclesData?.cycles ?? []}
          columns={columns}
          members={members}
        />
      )}
    </div>
  );
}
