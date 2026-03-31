import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import ColumnTemplate from "./templates/ColumnTemplate";
import { KanbanCard } from "./KanbanCard";
import type { Task, Column } from "~/types/task";
import {
  DEFAULT_TASK_COLUMN_COLORS,
  DEFAULT_TASK_COLUMN_IDS,
} from "~/types/task";

type KanbanColumnProps = {
  column: Column;
  cards: Task[];
  onAdd: () => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onDelete?: () => void;
  onUpdate?: () => void;
};

export function KanbanColumn({
  column,
  cards,
  onAdd,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onDelete,
  onUpdate,
}: KanbanColumnProps) {
  const columnId = column.id ?? column._id ?? "";
  const columnColor =
    DEFAULT_TASK_COLUMN_COLORS[columnId] || column.accentColor || "#6B7280";
  const canManage =
    !DEFAULT_TASK_COLUMN_IDS.includes(columnId) &&
    (column.isDefault === false || columnId.startsWith("col-"));
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  return (
    <div className="flex flex-col w-80 shrink-0 bg-gradient-to-b from-card to-card/80 backdrop-blur-sm border border-border rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="px-4 pt-4 pb-2">
        <ColumnTemplate
          title={column.title}
          count={cards.length}
          onAdd={onAdd}
          color={columnColor}
          canManage={canManage}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 min-h-[200px] rounded-b-xl transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""
        }`}
      >
        <SortableContext
          items={cards.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard
              key={card._id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
