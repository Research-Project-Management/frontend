'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import {
  Plus,
  Minimize2,
  Maximize2,
  MoreHorizontal,
  Trash2,
  Copy,
  UserPlus,
  UserMinus,
  RotateCcw,
  CheckSquare,
  Clock3,
  Bug,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useKanban, useCard, type TaskCardLabel } from '../../hooks/use-kanban';
import {
  type Task,
  type Column as ColumnType,
  resolveTaskColumnId,
  resolveTaskColumnColor,
} from '../../types/types';

export type { TaskCardLabel };

// ── Card Component ──────────────────────────────────────────────────────────

export interface CardProps {
  card: Task;
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onJoin?: (card: Task) => void;
  onLeave?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function CardUI({
  card,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onRemoveFromCycle,
  isReadOnly = false,
  isDragging = false,
  isSelected = false,
  onToggleSelect,
}: CardProps) {
  const { state, actions } = useCard({
    card,
    labelMap,
    currentUserId,
    currentUserAvatar,
    onEdit,
    onDuplicate,
    onDelete,
    onJoin,
    onLeave,
    onRemoveFromCycle,
    isReadOnly,
  });

  const {
    dates,
    labels,
    assignee,
    metadataItems,
    showLabelDetails,
  } = state;

  const {
    toggleLabelDetails,
    duplicate,
    remove,
    join,
    leave,
    removeFromCycle,
    edit,
  } = actions;

  const isDone = card.columnId === 'done';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => edit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          edit();
        }
      }}
      aria-label={`Work item: ${card.title}`}
      className={cn(
        'group relative min-w-0 rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
        isDragging && 'opacity-40 border-primary',
        isSelected && 'ring-1 ring-ring border-ring bg-muted'
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        aria-label={isSelected ? `Deselect ${card.title}` : `Select ${card.title}`}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect?.(card.id);
        }}
        className={cn(
          'absolute left-2 top-2 z-10 size-3.5 rounded border-border transition-opacity cursor-pointer accent-primary',
          isSelected ? 'opacity-100' : 'max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        )}
      />

      <div className="flex items-start justify-between gap-2 pl-4">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.identifier && (
            <span className="font-mono text-11 font-medium text-muted-foreground shrink-0 tabular-nums">
              {card.identifier}
            </span>
          )}
        </div>

        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Options for ${card.title}`}
                className="size-6 -mr-1.5 -mt-1 max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onDuplicate && (
                <DropdownMenuItem onClick={duplicate}>
                  <Copy className="mr-2 size-3.5 shrink-0" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {currentUserId && (
                <DropdownMenuItem onClick={assignee.isCurrentUser ? leave : join}>
                  {assignee.isCurrentUser ? (
                    <>
                      <UserMinus className="mr-2 size-3.5 shrink-0" />
                      Leave card
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 size-3.5 shrink-0" />
                      Join card
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onRemoveFromCycle && (
                <DropdownMenuItem onClick={removeFromCycle}>
                  <RotateCcw className="mr-2 size-3.5 shrink-0" />
                  Remove from cycle
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={remove}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5 shrink-0" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p
        className={cn(
          'mt-1 text-xs font-medium text-foreground line-clamp-2 leading-relaxed',
          isDone && 'line-through text-muted-foreground'
        )}
      >
        {card.title}
      </p>

      {labels.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1"
          onClick={(e) => {
            e.stopPropagation();
            toggleLabelDetails();
          }}
        >
          {labels.map((lbl: { id: string; color: string; title: string }) => (
            <span
              key={lbl.id}
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-10 font-medium transition-opacity',
                showLabelDetails ? 'opacity-100' : 'opacity-80'
              )}
              style={{
                backgroundColor: `${lbl.color}20`,
                color: lbl.color,
              }}
            >
              {lbl.title}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-11 text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {metadataItems.map((meta, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 shrink-0" title={meta.label}>
              <meta.icon className="size-3 text-muted-foreground" />
              {meta.text && <span>{meta.text}</span>}
            </span>
          ))}

          {dates.display && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-mono text-10 font-medium tabular-nums',
                dates.isOverdue ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <Clock3 className="size-3 shrink-0" />
              {dates.display}
            </span>
          )}
        </div>

        {assignee.user && (
          <Avatar className="size-5 shrink-0">
            <AvatarImage src={assignee.avatar} />
            <AvatarFallback className="text-9">{assignee.initials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

export function Card(props: CardProps) {
  const { card } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'Task',
      task: card,
    },
    disabled: props.isReadOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardUI {...props} isDragging={isDragging} />
    </div>
  );
}

// ── Column Component ────────────────────────────────────────────────────────

export interface ColumnProps {
  column: ColumnType;
  cards: Task[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard?: (columnId: string, title?: string) => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onJoinCard?: (card: Task) => void;
  onLeaveCard?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onEditColumn?: (column: ColumnType) => void;
  onDeleteColumn?: (column: ColumnType) => void;
  cycleId?: string;
  isReadOnly?: boolean;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (taskId: string) => void;
}

export function Column({
  column,
  cards,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onEditColumn,
  onDeleteColumn,
  cycleId,
  isReadOnly = false,
  selectedTaskIds = [],
  onToggleSelectTask,
}: ColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const columnId = resolveTaskColumnId(column);
  const columnColor = resolveTaskColumnColor(columnId, column.accentColor);

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: 'Column',
      column,
    },
  });

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  useEffect(() => {
    if (isQuickAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isQuickAdding]);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !onAddCard) return;
    onAddCard(columnId, quickTitle.trim());
    setQuickTitle('');
    setIsQuickAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg bg-secondary border border-border transition-colors',
        isOver && 'border-ring bg-muted',
        isCollapsed ? 'w-12 shrink-0' : 'w-72 shrink-0 max-h-full min-h-[160px]'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            const titleLower = (column.title || '').toLowerCase().trim();
            const groupLower = ((column as any).group || (column as any).category || '').toLowerCase().trim();
            if (titleLower.includes('done') || titleLower.includes('completed') || groupLower === 'completed') {
              return (
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5 shrink-0" aria-label="Done">
                  <circle cx="8" cy="8" r="7" fill="#10b981" />
                  <path d="M4.75 8.25L7 10.5L11.5 5.75" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
            }
            if (titleLower.includes('cancel') || groupLower === 'cancelled') {
              return (
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5 shrink-0" aria-label="Cancelled">
                  <circle cx="8" cy="8" r="7" fill="#ef4444" />
                  <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
            }
            return (
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: columnColor }}
              />
            );
          })()}
          {!isCollapsed && (
            <>
              <h3 className="text-xs font-semibold text-foreground truncate">{column.title}</h3>
              <span className="font-mono text-11 font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
                {cards.length}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand column' : 'Collapse column'}
          >
            {isCollapsed ? (
              <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.75} />
            ) : (
              <Minimize2 className="size-3.5 shrink-0" strokeWidth={1.75} />
            )}
          </Button>

          {!isCollapsed && !isReadOnly && onAddCard && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => setIsQuickAdding(true)}
              title="Add card"
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>

      {/* Cards List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
          {isQuickAdding && (
            <form onSubmit={handleQuickAddSubmit} className="p-2 bg-card rounded-lg border border-border shadow-xs space-y-2">
              <input
                ref={inputRef}
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsQuickAdding(false);
                    setQuickTitle('');
                  }
                }}
                placeholder="What needs to be done?"
                className="w-full text-xs bg-transparent border-none p-0 outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-end gap-1 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-10 px-2"
                  onClick={() => setIsQuickAdding(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-6 text-10 px-2" disabled={!quickTitle.trim()}>
                  Add
                </Button>
              </div>
            </form>
          )}

          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <Card
                key={card.id}
                card={card}
                labelMap={labelMap}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                onEdit={onEditCard}
                onDuplicate={onDuplicateCard}
                onDelete={onDeleteCard}
                onJoin={onJoinCard}
                onLeave={onLeaveCard}
                onRemoveFromCycle={onRemoveFromCycle}
                isReadOnly={isReadOnly}
                isSelected={selectedTaskIds.includes(card.id)}
                onToggleSelect={onToggleSelectTask}
              />
            ))}
          </SortableContext>

          {!isQuickAdding && !isReadOnly && onAddCard && (
            <button
              type="button"
              onClick={() => setIsQuickAdding(true)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted transition-colors w-full text-left"
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span>New work item</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── BoardView Component ─────────────────────────────────────────────────────

export interface BoardViewProps {
  tasks: Task[];
  tasksByColumnId?: Map<string, Task[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard?: (columnId: string, title?: string) => void;
  onEditCard?: (card: Task) => void;
  onDeleteCard?: (card: Task) => void;
  onDuplicateCard?: (card: Task) => void;
  onJoinCard?: (card: Task) => void;
  onLeaveCard?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onMoveCard?: (taskId: string, newColumnId: string) => void;
  onReorderCard?: (taskId: string, newColumnId: string, rank: number) => void;
  onEditColumn?: (column: ColumnType) => void;
  onDeleteColumn?: (column: ColumnType) => void;
  cycleId?: string;
  isReadOnly?: boolean;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (id: string) => void;
}

export type BoardProps = BoardViewProps;

export function BoardView({
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
  onRemoveFromCycle,
  onMoveCard,
  onReorderCard,
  onEditColumn,
  onDeleteColumn,
  cycleId,
  isReadOnly = false,
  selectedTaskIds = [],
  onToggleSelectTask,
}: BoardViewProps) {
  const { state: kanbanState, actions: kanbanActions } = useKanban({
    tasks,
    columns,
    onMoveCard,
    isReadOnly,
  });

  const { tasksByColumn, activeTask, sensors } = kanbanState;
  const { dragStart, dragEnd, dragCancel } = kanbanActions;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 min-w-0 bg-background select-none">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={dragStart}
        onDragEnd={dragEnd}
        onDragCancel={dragCancel}
      >
        <div className="flex h-full items-start gap-3 min-w-max pb-4">
          {columns.map((col) => {
            const colId = resolveTaskColumnId(col);
            const columnCards = tasksByColumn.get(colId) || [];
            return (
              <Column
                key={colId}
                column={col}
                cards={columnCards}
                labelMap={labelMap}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                onAddCard={onAddCard}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                onJoinCard={onJoinCard}
                onLeaveCard={onLeaveCard}
                onRemoveFromCycle={onRemoveFromCycle}
                onEditColumn={onEditColumn}
                onDeleteColumn={onDeleteColumn}
                cycleId={cycleId}
                isReadOnly={isReadOnly}
                selectedTaskIds={selectedTaskIds}
                onToggleSelectTask={onToggleSelectTask}
              />
            );
          })}
        </div>

        {isMounted &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeTask ? (
                <div className="w-72 rotate-1 cursor-grabbing opacity-90">
                  <CardUI
                    card={activeTask}
                    labelMap={labelMap}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    isReadOnly={isReadOnly}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}

export const Board = BoardView;
export default BoardView;
