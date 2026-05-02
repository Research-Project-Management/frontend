import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Column } from "../Column";
import { CardUI, type TaskCardLabel } from "../Card";
import { Plus } from "lucide-react";
import {
  resolveTaskColumnId,
  type Task,
  type Column as ColumnType,
} from "~/types/task";

type BoardViewProps = {
  tasks: Task[];
  tasksByColumnId: Map<string, Task[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
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
  onCreateColumn?: () => void;
  isAddingCard?: boolean;
  cycleId?: string;
};

export default function BoardView({
  tasks,
  tasksByColumnId,
  columns,
  labelMap,
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
  onCreateColumn,
  isAddingCard,
  cycleId,
}: BoardViewProps) {
  const [activeCard, setActiveCard] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const getTargetColumnId = useCallback((overId: string) => {
    if (columns.some((col) => resolveTaskColumnId(col) === overId)) {
      return overId;
    }

    return tasks.find((task) => task._id === overId)?.columnId ?? null;
  }, [columns, tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = tasks.find((c) => c._id === event.active.id);
    if (card) {
      setActiveCard(card);
    }
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const targetColumnId = getTargetColumnId(String(over.id));

    if (targetColumnId) {
      const task = tasks.find((t) => t._id === taskId);
      if (task && task.columnId !== targetColumnId) {
        onMoveCard(taskId, targetColumnId);
      }
    }
  }, [getTargetColumnId, onMoveCard, tasks]);

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
  }, []);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4 kanban-scrollbar">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-5 h-full min-w-max pb-4">
          {columns?.map((column) => {
            if (!column) return null;
            const columnId = resolveTaskColumnId(column);
            if (!columnId) return null;
            
            const columnCards = tasksByColumnId?.get(columnId) ?? [];

            return (
              <Column
                key={columnId}
                column={column}
                cards={columnCards}
                labelMap={labelMap}
                onAdd={onAddCard}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                onJoinCard={onJoinCard}
                onLeaveCard={onLeaveCard}
                onToggleCardCompleted={onToggleCardCompleted}
                onDelete={onDeleteColumn}
                onUpdate={onUpdateColumn}
                onAddDisabled={isAddingCard}
              />
            );
          })}

          {onCreateColumn && (
            <div className="w-72 shrink-0">
              <button
                type="button"
                onClick={onCreateColumn}
                className="flex w-full items-center gap-2 rounded-sm bg-[#f4f5f7] px-4 py-2.5 text-[14px] font-semibold text-zinc-600 transition-all hover:bg-zinc-200/50 hover:text-zinc-900"
              >
                <Plus className="size-4" />
                <span>Add column</span>
              </button>
            </div>
          )}
        </div>

        {createPortal(
          <DragOverlay 
            dropAnimation={dropAnimation}
            style={{ pointerEvents: 'none' }}
          >
            {activeCard ? (
              <div className="z-[1000] w-72 origin-center scale-105 shadow-2xl">
                <CardUI card={activeCard} labelMap={labelMap} />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.5",
      },
    },
  }),
};
