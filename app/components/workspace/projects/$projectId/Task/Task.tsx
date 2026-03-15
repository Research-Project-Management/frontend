import "./assets/board.css";
import "./assets/column.css";
import "./assets/card.css";
import { useState, useMemo } from "react";
import { useParams } from "react-router";
import TopBar from "./TopBar";
import BoardView from "./views/BoardView";
import ListView from "./views/ListView";
import { TaskDialog } from "./TaskDialog";
import {
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useCreateColumn,
  useDeleteTask,
} from "~/query/task";
import { useProjectCycles } from "~/query/cycle";
import type { Task as TaskType, Priority } from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";

type ViewMode = "board" | "list";
type GroupBy = "status" | "priority";

export default function Task() {
  const { projectId } = useParams();
  const { data, isLoading } = useProjectTasks(projectId!);
  const { data: cyclesData } = useProjectCycles(projectId!);

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const createColumnMutation = useCreateColumn();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [searchText, setSearchText] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>(
    null,
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogCard, setDialogCard] = useState<Partial<TaskType>>({});

  const allTasks = data?.tasks || [];
  const columns = data?.columns || [];
  const cycles = cyclesData?.cycles || [];

  // Filtered tasks
  const tasks = useMemo(() => {
    let filtered = allTasks;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.identifier?.toLowerCase().includes(q),
      );
    }

    if (selectedCycleId) {
      filtered = filtered.filter(
        (t) =>
          t.cycle &&
          (typeof t.cycle === "string"
            ? t.cycle === selectedCycleId
            : t.cycle._id === selectedCycleId),
      );
    }

    if (selectedPriority) {
      filtered = filtered.filter((t) => t.priority === selectedPriority);
    }

    return filtered;
  }, [allTasks, searchText, selectedCycleId, selectedPriority]);

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

  const handleSaveCard = (cardData: Partial<TaskType>) => {
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

  const handleDeleteCard = () => {
    if (
      dialogCard._id &&
      confirm("Are you sure you want to delete this task?")
    ) {
      deleteTaskMutation.mutate(
        { taskId: dialogCard._id, projectId: projectId! },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Task deleted");
          },
        },
      );
    }
  };

  const handleCreateSection = (payload: any): void => {
    createColumnMutation.mutate(
      {
        projectId: projectId!,
        title: payload.sectionName,
        accentColor: payload.selectedColor,
        isDefault: payload.isDefault,
      },
      { onSuccess: () => toast.success("Column created") },
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
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          searchText={searchText}
          onSearchChange={setSearchText}
          selectedCycleId={selectedCycleId}
          onCycleChange={setSelectedCycleId}
          selectedPriority={selectedPriority}
          onPriorityChange={setSelectedPriority}
          cycles={cycles}
          onCreateSection={handleCreateSection}
        />
      </header>

      {viewMode === "board" ? (
        <BoardView
          tasks={tasks}
          columns={columns}
          projectId={projectId!}
          onAddCard={handleOpenAddDialog}
          onEditCard={handleOpenEditDialog}
          onMoveCard={handleMoveCard}
        />
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4">
          <ListView
            tasks={tasks}
            columns={columns}
            onEditCard={handleOpenEditDialog}
            groupBy={groupBy}
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
      />
    </div>
  );
}
