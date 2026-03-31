import { useState, useMemo } from "react";
import { useParams } from "react-router";
import TopBar from "./TopBar";
import BoardView from "./views/BoardView";
import ListView from "./views/ListView";
import { TaskDialog } from "./TaskDialog";
import SectionModal, { type SectionData } from "./modals/SectionModal";
import DeleteConfirmModal from "./modals/SectionModal/DeleteConfirmModal";
import {
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useCreateColumn,
  useDeleteTask,
  useDeleteColumn,
  useUpdateColumn,
} from "~/query/task";
import type {
  Task as TaskType,
  Column,
  TaskMutationInput,
} from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";

type ViewMode = "board" | "list";

export default function Task() {
  const { projectId } = useParams();
  const { data, isLoading } = useProjectTasks(projectId!);

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const createColumnMutation = useCreateColumn();
  const deleteColumnMutation = useDeleteColumn();
  const updateColumnMutation = useUpdateColumn();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchText, setSearchText] = useState("");
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogCard, setDialogCard] = useState<Partial<TaskType>>({});
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null);

  // Column Modals state
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);
  const [sectionModalMode, setSectionModalMode] = useState<"create" | "edit">("create");
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const allTasks = data?.tasks || [];
  const columns = data?.columns || [];

  // Filtered tasks
  const tasks = useMemo(() => {
    let filtered = allTasks;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q),
      );
    }

    if (selectedColumnIds.length > 0) {
      filtered = filtered.filter((t) => selectedColumnIds.includes(t.columnId));
    }

    return filtered;
  }, [allTasks, searchText, selectedColumnIds]);

  const visibleColumns = useMemo(() => {
    if (selectedColumnIds.length > 0) {
      return columns.filter((column) =>
        selectedColumnIds.includes(column.id ?? column._id ?? ""),
      );
    }

    if (!searchText.trim()) {
      return columns;
    }

    const taskColumnIds = new Set(tasks.map((task) => task.columnId));
    return columns.filter((column) =>
      taskColumnIds.has(column.id ?? column._id ?? ""),
    );
  }, [columns, selectedColumnIds, searchText, tasks]);
  const hasActiveTaskFilters =
    Boolean(searchText.trim()) || selectedColumnIds.length > 0;

  /* Handlers */
  const handleOpenAddDialog = (columnId: string) => {
    setDialogMode("add");
    setDialogCard({ columnId });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (card: TaskType) => {
    setDialogMode("edit");
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

  const handleSaveCard = (cardData: TaskMutationInput) => {
    if (dialogMode === "add") {
      createTaskMutation.mutate(
        { projectId: projectId!, ...cardData },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Task created");
          },
        },
      );
    } else {
      updateTaskMutation.mutate(
        { taskId: dialogCard._id!, projectId: projectId!, ...cardData },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Task updated");
          },
        },
      );
    }
  };

  const closeTaskDeleteModal = () => {
    setDeletingTask(null);
  };

  const openTaskDeleteModal = (task: TaskType) => {
    setDeletingTask(task);
  };

  const handleDeleteCard = () => {
    if (dialogCard._id) {
      openTaskDeleteModal(dialogCard as TaskType);
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
    columns.find((column) => (column.id ?? column._id ?? "") === id);

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
        isDefault: payload.isDefault,
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
    openTaskDeleteModal(card);
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
    const duplicatePayload: TaskMutationInput = {
      title: `${card.title} (copy)`,
      content: card.content,
      description: card.description,
      columnId: card.columnId,
      dueDate: card.dueDate,
      labels: card.labels || [],
      priority: card.priority,
      estimate: card.estimate,
      assignee:
        typeof card.assignee === "object" ? card.assignee?._id : card.assignee,
      cycle: card.cycle && typeof card.cycle === "object" ? card.cycle._id : card.cycle,
      parentTask:
        card.parentTask && typeof card.parentTask === "object"
          ? card.parentTask._id
          : card.parentTask,
    };

    createTaskMutation.mutate(
      { projectId: projectId!, ...duplicatePayload },
      {
        onSuccess: () => {
          toast.success("Task duplicated");
        },
      },
    );
  };


  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="flex-1 flex gap-5 p-6">
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="shrink-0 border-b border-border">
        <TopBar
          viewMode={viewMode}
          onViewChange={setViewMode}
          searchText={searchText}
          onSearchChange={setSearchText}
          columns={columns}
          selectedColumnIds={selectedColumnIds}
          onColumnFilterChange={setSelectedColumnIds}
          onCreateSection={handleOpenAddSectionModal}
        />
      </header>

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
          columns={visibleColumns}
          onAddCard={handleOpenAddDialog}
          onEditCard={handleOpenEditDialog}
          onDeleteCard={handleDeleteCardFromMenu}
          onDuplicateCard={handleDuplicateCard}
          onMoveCard={handleMoveCard}
          onDeleteColumn={handleOpenDeleteModal}
          onUpdateColumn={handleOpenRenameModal}
        />
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4">
          <ListView
            tasks={tasks}
            columns={visibleColumns}
            onAddCard={handleOpenAddDialog}
            onEditCard={handleOpenEditDialog}
            onDeleteCard={handleDeleteCardFromMenu}
            onDuplicateCard={handleDuplicateCard}
          />
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        card={dialogCard}
        columns={columns}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onDuplicate={() => dialogCard._id && handleDuplicateCard(dialogCard as TaskType)}
      />

      {/* Column Management Modals */}
      <SectionModal
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
          isDefault: editingColumn.isDefault,
        } : undefined}
        isLoading={createColumnMutation.isPending || updateColumnMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleColumnDeleteConfirm}
        title={`Delete "${deletingColumn?.title}"`}
        confirmLabel="Delete column"
        isLoading={deleteColumnMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingTask)}
        onClose={closeTaskDeleteModal}
        onConfirm={handleTaskDeleteConfirm}
        title="Delete task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete task"
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
}
