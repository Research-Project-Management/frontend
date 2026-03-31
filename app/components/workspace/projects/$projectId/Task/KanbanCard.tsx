import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CardTemplate } from "./templates/CardTemplate";
import type { Task } from "~/types/task";

type KanbanCardProps = {
  card: Task;
  onEdit?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
};

export function KanbanCard({
  card,
  onEdit,
  onDelete,
  onDuplicate,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card._id,
      data: { card },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-card cursor-pointer"
      {...attributes}
      {...listeners}
      onClick={() => onEdit?.(card)}
    >
      <CardTemplate
        card={card}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    </div>
  );
}
