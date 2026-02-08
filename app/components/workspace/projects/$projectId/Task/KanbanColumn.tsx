import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import ColumnTemplate from "./templates/ColumnTemplate";
import { KanbanCard } from "./KanbanCard";
import type { Task, Column } from "~/types/task";

type KanbanColumnProps = {
  column: Column;
  cards: Task[];
  onAdd: () => void;
  onEditCard?: (card: Task) => void;
};

export function KanbanColumn({
  column,
  cards,
  onAdd,
  onEditCard,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col w-80 shrink-0 bg-gradient-to-b from-card to-card/80 backdrop-blur-sm border border-border rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="px-4 pt-4 pb-2">
        <ColumnTemplate
          title={column.title}
          count={cards.length}
          onAdd={onAdd}
          color={column.accentColor}
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
            <KanbanCard key={card._id} card={card} onEdit={onEditCard} />
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
