import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import { Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Card } from "./Card";
import type { Task, Column as ColumnType } from "~/types/task";
import {
  DEFAULT_TASK_COLUMN_IDS,
  resolveTaskColumnColor,
  resolveTaskColumnId,
} from "~/types/task";

type ColumnProps = {
  column: ColumnType;
  cards: Task[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAdd: (columnId: string, title?: string) => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onJoinCard?: (card: Task) => void;
  onLeaveCard?: (card: Task) => void;
  onToggleCardCompleted?: (card: Task) => void;
  onDelete?: () => void;
  onUpdate?: () => void;
};

export function Column({
  column,
  cards,
  currentUserId,
  currentUserAvatar,
  onAdd,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onToggleCardCompleted,
  onDelete,
  onUpdate,
}: ColumnProps) {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const columnId = resolveTaskColumnId(column);
  const columnColor = resolveTaskColumnColor(columnId, column.accentColor);
  const canManage =
    !DEFAULT_TASK_COLUMN_IDS.includes(columnId) &&
    (column.isDefault === false || columnId.startsWith("col-"));
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  useEffect(() => {
    if (!isQuickAddOpen) return;
    quickAddInputRef.current?.focus();
  }, [isQuickAddOpen]);

  const handleOpenQuickAdd = () => {
    setIsQuickAddOpen(true);
  };

  const handleCloseQuickAdd = () => {
    setIsQuickAddOpen(false);
    setQuickAddTitle("");
  };

  const handleQuickAddSubmit = () => {
    const trimmedTitle = quickAddTitle.trim();
    if (!trimmedTitle) return;

    onAdd(columnId, trimmedTitle);
    setQuickAddTitle("");
    setIsQuickAddOpen(false);
  };

  return (
    <div className="flex flex-col w-80 shrink-0 bg-linear-to-b from-card to-card/80 backdrop-blur-sm border border-border rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="px-4 pt-4 pb-2">
        <div 
          className="flex w-full items-center justify-between px-3 py-2.5 rounded-t-md relative"
          style={{ 
            backgroundColor: `${columnColor}08`,
            borderBottom: `2px solid ${columnColor}20`
          }}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-1 h-5 rounded-full shrink-0"
              style={{ backgroundColor: columnColor }}
            />
            
            <h3 
              className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => canManage && onUpdate?.()}
            >
              {column.title}
            </h3>
            
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-medium shrink-0"
              style={{
                backgroundColor: `${columnColor}18`,
                color: columnColor,
              }}
            >
              {cards.length}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleOpenQuickAdd}
              aria-label="Add card"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="More column actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onUpdate?.()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename column
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.()}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 min-h-50 rounded-b-xl transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""
        }`}
      >
        <SortableContext
          items={cards.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <Card
              key={card._id}
              card={card}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
              onJoin={onJoinCard}
              onLeave={onLeaveCard}
              onToggleComplete={onToggleCardCompleted}
            />
          ))}

          {isQuickAddOpen ? (
            <div className="w-full">
              <input
                ref={quickAddInputRef}
                type="text"
                value={quickAddTitle}
                onChange={(event) => setQuickAddTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleQuickAddSubmit();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCloseQuickAdd();
                  }
                }}
                placeholder="Nhập tiêu đề hoặc dán liên kết"
                className="h-12 w-full rounded-lg border border-[#d0d7e2] px-3 text-[15px] text-[#172b4d] outline-none transition-colors placeholder:text-[#7a869a] focus:border-[#388bff]"
              />

              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  type="button"
                  className="h-8 rounded-md bg-[#0c66e4] px-3 text-[13px] text-white hover:bg-[#0c66e4]/90"
                  onClick={handleQuickAddSubmit}
                  disabled={!quickAddTitle.trim()}
                >
                  Thêm
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-md px-2.5 text-[13px] text-[#44546f] hover:bg-[#091e420f]"
                  onClick={handleCloseQuickAdd}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : null}
        </SortableContext>
        {cards.length === 0 && !isQuickAddOpen && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
