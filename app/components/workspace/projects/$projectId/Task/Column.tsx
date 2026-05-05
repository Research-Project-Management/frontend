import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, MoreHorizontal, Trash2, Pencil, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Card, type TaskCardLabel } from "./Card";
import type { Task, Column as ColumnType } from "~/types/task";
import {
  resolveTaskColumnColor,
  resolveTaskColumnId,
} from "~/types/task";

type ColumnProps = {
  column: ColumnType;
  cards: Task[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAdd: (columnId: string, title?: string) => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onJoinCard?: (card: Task) => void;
  onLeaveCard?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onToggleCardCompleted?: (card: Task) => void;
  onDelete?: (columnId: string) => void;
  onUpdate?: (columnId: string) => void;
  onAddDisabled?: boolean;
  isReadOnly?: boolean;
};

function ColumnComponent({
  column,
  cards,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onAdd,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onToggleCardCompleted,
  onDelete,
  onUpdate,
  onAddDisabled,
  isReadOnly = false,
}: ColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const columnId = resolveTaskColumnId(column);
  const columnColor = resolveTaskColumnColor(columnId, column.accentColor);
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });
  const cardIds = useMemo(() => cards.map((card) => card._id), [cards]);

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

    // Reset local state before calling onAdd to prevent UI/batching conflicts
    setQuickAddTitle("");
    setIsQuickAddOpen(false);
    
    onAdd(columnId, trimmedTitle);
  };

  /* ── Collapsed state ──────────────────────────────────────────────── */
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center w-10 shrink-0 bg-[#f4f5f7] rounded-sm py-2.5 gap-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: columnColor }}
        />
        <span
          className="text-[13px] font-semibold text-zinc-800 max-h-36 overflow-hidden"
          style={{ writingMode: "vertical-lr" }}
        >
          {column.title}
        </span>
        <span
          className="text-[12px] text-zinc-500"
          style={{ writingMode: "vertical-lr", textOrientation: "upright" }}
        >
          {cards.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#6b778c] hover:bg-[#091e420f] hover:text-[#172b4d] shrink-0"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand column"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        {!isReadOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#6b778c] hover:bg-[#091e420f] hover:text-[#172b4d] shrink-0"
            onClick={() => {
              setIsCollapsed(false);
              handleOpenQuickAdd();
            }}
            aria-label="Add card"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 shrink-0"
                aria-label="More column actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-48">
              <DropdownMenuItem onClick={() => {
                setIsCollapsed(false);
                onUpdate?.(columnId);
              }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete?.(columnId)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  /* ── Expanded state ───────────────────────────────────────────────── */
  return (
    <div className={`flex flex-col w-85 shrink-0 rounded-sm transition-colors ${isOver ? "bg-zinc-200/60" : "bg-[#f4f5f7]"}`}>
      <div className="px-3 pt-3 pb-1">
        <div className="flex w-full items-center justify-between px-1 pb-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: columnColor }}
            />
            <h3 
              className="text-[14px] font-semibold text-zinc-900 truncate cursor-pointer hover:text-black transition-colors"
              onClick={() => onUpdate?.(columnId)}
            >
              {column.title}
            </h3>
            <span
              className="text-[13px] text-zinc-500 font-normal shrink-0"
            >
              {cards.length}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#6b778c] hover:bg-[#091e420f] hover:text-[#172b4d]"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse column"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>

            {!isReadOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#6b778c] hover:bg-[#091e420f] hover:text-[#172b4d]"
                onClick={handleOpenQuickAdd}
                aria-label="Add card"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}

            {!isReadOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900"
                    aria-label="More column actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onUpdate?.(columnId)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(columnId)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-32 rounded-b-sm"
      >
        <SortableContext
          items={cardIds}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <Card
              key={card._id}
              card={card}
              labelMap={labelMap}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
              onJoin={onJoinCard}
              onLeave={onLeaveCard}
              onRemoveFromCycle={onRemoveFromCycle}
              onToggleComplete={onToggleCardCompleted}
              isReadOnly={isReadOnly}
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
                placeholder="What needs to be done?"
                className="h-10 w-full rounded-sm border border-zinc-200 px-3 text-[14px] text-zinc-900 font-medium outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 focus:border-zinc-400 shadow-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                disabled={onAddDisabled}
              />

              <div className="mt-2 text-[12px] flex items-center justify-start gap-1.5">
                <Button
                  type="button"
                  className="h-7 rounded-sm bg-black px-3 text-white hover:bg-black/90"
                  onClick={handleQuickAddSubmit}
                  disabled={!quickAddTitle.trim() || onAddDisabled}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 rounded-sm px-2.5 text-zinc-600 hover:bg-zinc-200/50"
                  onClick={handleCloseQuickAdd}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </SortableContext>
      </div>
    </div>
  );
}

const ColumnMemo = React.memo(ColumnComponent);
export function Column(props: ColumnProps) {
  return <ColumnMemo {...props} />;
}
Column.displayName = "Column";

