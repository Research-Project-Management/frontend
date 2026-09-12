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
  ChevronDown,
  User,
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
import { useKanban, useCard, type TaskCardLabel, type ItemCardLabel } from '../../hooks/use-view';
import { AvatarStack } from '../modals/Popovers';
import { ItemHelpers, ItemHelpers as TaskHelpers } from '../../utils/work-item.utils';
import {
  type Task,
  type Item,
  type Column as ColumnType,
  type DisplayOptions,
  type BaseWorkItemViewProps,
  type WorkItemCardHandlers,
} from '../../types/work-item.types';
import { resolveColumnId, resolveColumnColor, resolveTaskColumnId, resolveTaskColumnColor } from '../../utils/work-item.utils';

export type { TaskCardLabel, ItemCardLabel };

// ── Card Component ──────────────────────────────────────────────────────────

export interface CardProps {
  card: Item;
  displayOptions?: DisplayOptions;
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  members?: any[];
  onEdit?: (card: Item) => void;
  onDuplicate?: (card: Item) => void;
  onDelete?: (card: Item) => void;
  onJoin?: (card: Item) => void;
  onLeave?: (card: Item) => void;
  onRemoveFromCycle?: (card: Item) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function CardUI({
  card,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members,
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
  const resolvedAssignees = useMemo(() => {
    return TaskHelpers.resolveAssignees(card, members);
  }, [card, members]);

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
          {card.identifier && (displayOptions?.properties?.id !== false) && (
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

      {labels.length > 0 && (displayOptions?.properties?.labels !== false) && (
        <div
          className="mt-2 flex flex-wrap gap-1"
          onClick={(e) => {
            e.stopPropagation();
            toggleLabelDetails();
          }}
        >
          {labels.map((lbl: { id: string; color?: string; title: string }) => (
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
          {metadataItems
            .filter((meta: any) => {
              if (meta.key === 'priority' && displayOptions?.properties?.priority === false) return false;
              if (meta.key === 'subtasks' && displayOptions?.properties?.subtaskCount === false) return false;
              if (meta.key === 'attachments' && displayOptions?.properties?.attachmentCount === false) return false;
              if (meta.key === 'due-date' && displayOptions?.properties?.dueDate === false) return false;
              return true;
            })
            .map((meta: any, idx: number) => (
            <span key={idx} className="inline-flex items-center gap-1 shrink-0" title={meta.label}>
              <meta.icon className="size-3 text-muted-foreground" />
              {meta.text && <span>{meta.text}</span>}
            </span>
          ))}

          {dates.display && (displayOptions?.properties?.dueDate !== false) && (
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

        {(displayOptions?.properties?.assignee !== false) && (
          resolvedAssignees.length > 1 ? (
            <AvatarStack users={resolvedAssignees} size="xs" max={3} />
          ) : resolvedAssignees.length === 1 ? (
            <Avatar className="size-5 shrink-0" title={resolvedAssignees[0].name || ''}>
              <AvatarImage src={resolvedAssignees[0].avatar || undefined} />
              <AvatarFallback className="text-9">
                {(resolvedAssignees[0].name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : assignee.user ? (
            <Avatar className="size-5 shrink-0">
              <AvatarImage src={assignee.avatar} />
              <AvatarFallback className="text-9">{assignee.initials}</AvatarFallback>
            </Avatar>
          ) : null
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
      type: 'Item',
      item: card,
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

export interface ColumnProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  column: ColumnType;
  cards: Item[];
  droppableId?: string;
  laneId?: string;
  subGroupBy?: string;
  labelMap?: Map<string, TaskCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onEditColumn?: (column: ColumnType) => void;
  onDeleteColumn?: (column: ColumnType) => void;
  cycleId?: string;
}

export function Column({
  column,
  cards,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members,
  droppableId,
  laneId,
  subGroupBy,
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
  selectedIds: propSelectedIds,
  selectedTaskIds: propSelectedTaskIds = [],
  onToggleSelect: propOnToggleSelect,
  onToggleSelectTask: propOnToggleSelectTask,
}: ColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTaskIds = propSelectedIds || propSelectedTaskIds;
  const onToggleSelectTask = propOnToggleSelect || propOnToggleSelectTask;
  const columnId = resolveTaskColumnId(column);
  const columnColor = resolveTaskColumnColor(columnId, column.accentColor);

  const effectiveDroppableId = droppableId || columnId;
  const { setNodeRef, isOver } = useDroppable({
    id: effectiveDroppableId,
    data: {
      type: 'Column',
      column,
      laneId,
      subGroupBy,
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
    onAddCard(
      columnId,
      quickTitle.trim(),
      laneId && subGroupBy && subGroupBy !== 'none'
        ? { subGroupBy, laneId }
        : undefined
    );
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
                displayOptions={displayOptions}
                labelMap={labelMap}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                members={members}
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

export interface BoardViewProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  items?: Item[];
  tasks?: Item[];
  itemsByColumnId?: Map<string, Item[]>;
  tasksByColumnId?: Map<string, Item[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onMoveCard?: (taskId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderCard?: (taskId: string, newColumnId: string, rank: number) => void;
  onEditColumn?: (column: ColumnType) => void;
  onDeleteColumn?: (column: ColumnType) => void;
  cycleId?: string;
}

export type BoardProps = BoardViewProps;

interface SwimlaneDef {
  id: string;
  title: string;
  color?: string;
  icon?: React.ReactNode;
}

export function BoardView({
  items: propItems,
  tasks: propTasks,
  itemsByColumnId: propItemsByColumnId,
  tasksByColumnId: propTasksByColumnId,
  columns,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members = [],
  cycles = [],
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
  selectedIds: propSelectedIds,
  selectedTaskIds: propSelectedTaskIds = [],
  onToggleSelect: propOnToggleSelect,
  onToggleSelectTask: propOnToggleSelectTask,
}: BoardViewProps) {
  const tasks = propItems || propTasks || [];
  const items = tasks;
  const selectedTaskIds = propSelectedIds || propSelectedTaskIds || [];
  const selectedIds = selectedTaskIds;
  const onToggleSelectTask = propOnToggleSelect || propOnToggleSelectTask;
  const onToggleSelect = onToggleSelectTask;
  const subGroupBy = displayOptions?.subGroupBy || 'none';
  const isSwimlanesActive = subGroupBy !== 'none';

  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});

  const toggleLaneCollapse = (laneId: string) => {
    setCollapsedLanes((prev) => ({ ...prev, [laneId]: !prev[laneId] }));
  };

  const swimlanes = useMemo<Array<SwimlaneDef & { tasksByColumn: Map<string, Task[]>; count: number }>>(() => {
    if (!isSwimlanesActive) return [];

    let defs: SwimlaneDef[] = [];
    if (subGroupBy === 'priority') {
      defs = [
        { id: 'urgent', title: 'Urgent', color: '#ef4444' },
        { id: 'high', title: 'High', color: '#f97316' },
        { id: 'medium', title: 'Medium', color: '#f59e0b' },
        { id: 'low', title: 'Low', color: '#3b82f6' },
        { id: 'none', title: 'No Priority', color: '#6b7280' },
      ];
    } else if (subGroupBy === 'assignee') {
      const memberLanes: SwimlaneDef[] = (members || []).map((m: any, idx: number) => {
        const userId = m.userId || m.user?.id || m.id || `member-${idx}`;
        const name = m.user?.name || m.name || 'Member';
        const avatar = m.user?.avatar || m.avatar;
        return {
          id: userId,
          title: name,
          color: '#6366f1',
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="text-9">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          ),
        };
      });
      defs = [
        ...memberLanes,
        {
          id: '__unassigned__',
          title: 'Unassigned',
          color: '#9ca3af',
          icon: <User className="size-3.5 text-muted-foreground shrink-0" />,
        },
      ];
    } else if (subGroupBy === 'cycle') {
      const cycleLanes: SwimlaneDef[] = (cycles || []).map((c: any) => ({
        id: c.id,
        title: c.name,
        color: '#3b82f6',
        icon: <RotateCcw className="size-3.5 text-blue-500 shrink-0" />,
      }));
      defs = [
        ...cycleLanes,
        {
          id: '__no_cycle__',
          title: 'No Cycle',
          color: '#9ca3af',
          icon: <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />,
        },
      ];
    } else {
      defs = [{ id: '__all__', title: 'All Items', color: '#6b7280' }];
    }

    const columnIds = columns.map((c) => resolveTaskColumnId(c));

    const result = defs.map((lane) => {
      const laneMap = new Map<string, Task[]>();
      columnIds.forEach((cid) => laneMap.set(cid, []));
      let count = 0;

      tasks.forEach((t: Task) => {
        let taskLaneId = 'none';
        if (subGroupBy === 'priority') {
          taskLaneId = (t.priority || 'none').toLowerCase();
        } else if (subGroupBy === 'assignee') {
          taskLaneId = TaskHelpers.resolveAssigneeId(t) || '__unassigned__';
        } else if (subGroupBy === 'cycle') {
          taskLaneId = t.cycleId || '__no_cycle__';
        }

        if (taskLaneId === lane.id) {
          count++;
          const colId = t.columnId || columnIds[0] || 'backlog';
          const list = laneMap.get(colId);
          if (list) {
            list.push(t);
          } else {
            laneMap.set(colId, [t]);
          }
        }
      });

      return {
        ...lane,
        tasksByColumn: laneMap,
        count,
      };
    });

    if (displayOptions?.showEmptyGroups === false) {
      const filtered = result.filter((l) => l.count > 0);
      return filtered.length > 0 ? filtered : result;
    }

    return result;
  }, [isSwimlanesActive, subGroupBy, members, cycles, columns, tasks, displayOptions?.showEmptyGroups]);

  const { state: kanbanState, actions: kanbanActions } = useKanban({
    tasks,
    columns,
    onMoveCard,
    isReadOnly,
    subGroupBy,
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
    <div className="flex-1 overflow-x-auto overflow-y-auto p-4 min-w-0 bg-background select-none">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={dragStart}
        onDragEnd={dragEnd}
        onDragCancel={dragCancel}
      >
        {isSwimlanesActive ? (
          <div className="space-y-4 pb-6 min-w-max">
            {swimlanes.map((lane) => {
              const isCollapsed = Boolean(collapsedLanes[lane.id]);
              return (
                <div
                  key={lane.id}
                  className="rounded-lg border border-border bg-card/40 overflow-hidden shadow-2xs"
                >
                  {/* Swimlane Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleLaneCollapse(lane.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleLaneCollapse(lane.id);
                      }
                    }}
                    className="flex items-center justify-between px-3.5 py-2 bg-muted/60 hover:bg-muted cursor-pointer select-none transition-colors border-b border-border/40"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={cn(
                          'size-4 text-muted-foreground transition-transform duration-150',
                          isCollapsed && '-rotate-90'
                        )}
                      />
                      {lane.icon ? (
                        lane.icon
                      ) : (
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: lane.color || '#6b7280' }}
                        />
                      )}
                      <span className="text-xs font-semibold text-foreground">
                        {lane.title}
                      </span>
                      <span className="font-mono text-10 font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full tabular-nums">
                        {lane.count}
                      </span>
                    </div>
                  </div>

                  {/* Swimlane Columns Grid */}
                  {!isCollapsed && (
                    <div className="flex items-start gap-3 p-3 overflow-x-auto min-w-max">
                      {columns.map((col) => {
                        const colId = resolveTaskColumnId(col);
                        const columnCards = lane.tasksByColumn.get(colId) || [];
                        return (
                          <Column
                            key={`${lane.id}:::${colId}`}
                            column={col}
                            cards={columnCards}
                            droppableId={`${lane.id}:::${colId}`}
                            laneId={lane.id}
                            subGroupBy={subGroupBy}
                            displayOptions={displayOptions}
                            labelMap={labelMap}
                            currentUserId={currentUserId}
                            currentUserAvatar={currentUserAvatar}
                            members={members}
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
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-start gap-3 min-w-max pb-4">
            {columns.map((col) => {
              const colId = resolveTaskColumnId(col);
              const columnCards = tasksByColumn.get(colId) || [];
              return (
                <Column
                  key={colId}
                  column={col}
                  cards={columnCards}
                  displayOptions={displayOptions}
                  labelMap={labelMap}
                  currentUserId={currentUserId}
                  currentUserAvatar={currentUserAvatar}
                  members={members}
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
        )}

        {isMounted &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeTask ? (
                <div className="w-72 rotate-1 cursor-grabbing opacity-90">
                  <CardUI
                    card={activeTask}
                    displayOptions={displayOptions}
                    labelMap={labelMap}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    members={members}
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
