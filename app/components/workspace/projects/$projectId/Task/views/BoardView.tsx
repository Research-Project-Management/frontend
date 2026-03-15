import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanColumn } from "../KanbanColumn";
import { CardTemplate } from "../templates/CardTemplate";
import type { Task, Column } from "~/types/task";

type BoardViewProps = {
  tasks: Task[];
  columns: Column[];
  projectId: string;
  onAddCard: (columnId: string) => void;
  onEditCard: (card: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
};

export default function BoardView({
  tasks,
  columns,
  onAddCard,
  onEditCard,
  onMoveCard,
}: BoardViewProps) {
  const [activeCard, setActiveCard] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = tasks.find((c) => c._id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as string;
    const task = tasks.find((t) => t._id === taskId);
    if (task && task.columnId !== targetColumnId) {
      onMoveCard(taskId, targetColumnId);
    }
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 h-full min-w-max">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={tasks.filter((task) => task.columnId === column.id)}
              onAdd={() => onAddCard(column.id)}
              onEditCard={onEditCard}
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
  );
}
