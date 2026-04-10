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
import { Column } from "../Column";
import { CardUI } from "../Card";
import {
  resolveTaskColumnId,
  type Task,
  type Column as ColumnType,
} from "~/types/task";

type BoardViewProps = {
  tasks: Task[];
  tasksByColumnId: Map<string, Task[]>;
  columns: ColumnType[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (card: Task) => void;
  onDeleteCard: (card: Task) => void;
  onDuplicateCard: (card: Task) => void;
  onJoinCard: (card: Task) => void;
  onLeaveCard: (card: Task) => void;
  onToggleCardCompleted: (card: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateColumn: (columnId: string) => void;
};

export default function BoardView({
  tasks,
  tasksByColumnId,
  columns,
  currentUserId,
  currentUserAvatar,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onToggleCardCompleted,
  onMoveCard,
  onDeleteColumn,
  onUpdateColumn,
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
          {columns.map((column) => {
            const columnId = resolveTaskColumnId(column);

            return (
              <Column
                key={columnId}
                column={column}
                cards={tasksByColumnId.get(columnId) ?? []}
                onAdd={(cId, title) => onAddCard(cId, title)}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                onJoinCard={onJoinCard}
                onLeaveCard={onLeaveCard}
                onToggleCardCompleted={onToggleCardCompleted}
                onDelete={() => onDeleteColumn(columnId)}
                onUpdate={() => onUpdateColumn(columnId)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="opacity-50">
              <CardUI card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
