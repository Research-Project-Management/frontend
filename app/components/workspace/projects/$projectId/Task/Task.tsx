import "./assets/board.css";
import "./assets/column.css";
import "./assets/card.css";
import { useState } from "react";
import { useParams } from "react-router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import TopBar from "./TopBar";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { TaskDialog } from "./TaskDialog";
import { CardTemplate } from "./templates/CardTemplate";
import {
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useCreateColumn,
  useDeleteTask,
} from "~/query/task";
import type { Task as TaskType } from "~/types/task";
import Loading from "~/components/ui/Loading";
import { toast } from "sonner";

export default function Task() {
  const { projectId } = useParams();
  const { data, isLoading } = useProjectTasks(projectId!);

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const createColumnMutation = useCreateColumn();

  const [activeCard, setActiveCard] = useState<TaskType | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogCard, setDialogCard] = useState<Partial<TaskType>>({});

  const tasks = data?.tasks || [];
  const columns = data?.columns || [];

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  /* Handlers */
  const handleDragStart = (event: DragStartEvent) => {
    const card = tasks.find((c) => c._id === event.active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as string;

    const task = tasks.find((t) => t._id === taskId);
    if (task && task.columnId !== targetColumnId) {
      updateTaskMutation.mutate({
        taskId,
        projectId: projectId!,
        columnId: targetColumnId,
      });
    }
  };

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

  const handleSaveCard = (cardData: Partial<TaskType>) => {
    if (dialogMode === "add") {
      createTaskMutation.mutate(
        {
          projectId: projectId!,
          ...cardData,
        },
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Task created");
          },
        },
      );
    } else {
      updateTaskMutation.mutate(
        {
          taskId: dialogCard._id!,
          projectId: projectId!,
          ...cardData,
        },
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
        {
          taskId: dialogCard._id,
          projectId: projectId!,
        },
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
      {
        onSuccess: () => {
          toast.success("Column created");
        },
      },
    );
  };

  if (isLoading) return <Loading />;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="shrink-0 border-b border-border">
        <TopBar onCreateSection={handleCreateSection} />
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4 bg-muted/20">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full min-w-max">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={tasks.filter((task) => task.columnId === column.id)}
                onAdd={() => handleOpenAddDialog(column.id)}
                onEditCard={handleOpenEditDialog}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="opacity-50">
                <CardTemplate card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

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
