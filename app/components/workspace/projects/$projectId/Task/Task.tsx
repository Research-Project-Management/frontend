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
import { useProjectDetails } from "~/query/project";
import { useProjects } from "~/hooks/useWorkspace";
import type {
  Task as TaskType,
  Column,
  TaskMutationInput,
} from "~/types/task";
import { resolveTaskColumnId } from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { KanbanSquare } from "lucide-react";

type ViewMode = "board" | "list" | "calendar";
type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

export default function Task() {
  const { user: currentUser } = useAuth();
  const { workspaceId, projectId } = useParams();
  const { data, isLoading } = useProjectTasks(projectId!);
  const { data: projectData } = useProjectDetails(projectId!);

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

  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);

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

    for (const task of tasks) {
      if (!grouped.has(task.columnId)) {
        grouped.set(task.columnId, []);
      }
      grouped.get(task.columnId)!.push(task);
    }

    return grouped;
  }, [tasks]);

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
      });
      return;
    }

    setDialogCard({
      columnId,
      title: title?.trim() || "",
      dueDate,
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
        ...cardData,
      },
      {
        onSuccess: (result: any) => {
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

  const handleAssignExistingTasksToDate = (
    taskIds: string[],
    dueDate: string,
  ) => {
    if (taskIds.length === 0) return;

    taskIds.forEach((taskId) => {
      updateTaskMutation.mutate({
        taskId,
        projectId: projectId!,
        dueDate,
      });
    });

    toast.success(
      taskIds.length === 1
        ? "Task added to calendar"
        : `${taskIds.length} tasks added to calendar`,
    );
  };


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
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Tasks"
        Icon={KanbanSquare}
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
            onCreateSection={handleOpenAddSectionModal}
          />
        }
      />

      {visibleColumns.length === 0 && hasActiveTaskFilters ? (
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
          onDeleteColumn={handleOpenDeleteModal}
          onUpdateColumn={handleOpenRenameModal}
          isAddingCard={createTaskMutation.isPending}
        />
      ) : viewMode === "list" ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
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
            isAddingCard={createTaskMutation.isPending}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <CalendarView
            tasks={allTasks}
            columns={columns}
            workspaceId={workspaceId ?? ""}
            projectId={projectId ?? ""}
            onAddCard={handleOpenAddDialog}
            onOpenCardDetail={handleOpenEditDialog}
            onAssignExistingTasks={handleAssignExistingTasksToDate}
            isAddingCard={createTaskMutation.isPending}
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
    </div>
  );
}
