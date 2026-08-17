'use client';

import { useState, useMemo, useEffect, memo, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import {
  AlignLeft,
  CheckSquare,
  Clock3,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  UserMinus,
  UserPlus,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import {
  PRIORITY_CONFIG,
  resolveTaskColumnColor,
  resolveTaskColumnId,
  type Priority,
  type Task,
  type Column,
} from "../../types/task.types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams } from "next/navigation";
import { useLabelsQuery } from '../../hooks/use-task';
import { cn } from "@/shared/lib/utils";
import { createPortal } from "react-dom";

/* Helper Functions */
function isValidDate(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isOverdue(value?: string | null) {
  if (!isValidDate(value)) return false;
  const date = new Date(value!);
  return date.getTime() < Date.now();
}

function formatDueDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

/* Sub-components */
const PriorityBadge = memo(({
  priority,
  showLabel = false,
}: {
  priority: Priority;
  showLabel?: boolean;
}) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
  if (priority === "none" && !showLabel) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs shrink-0"
      title={config.label}
    >
      <span
        className="size-2.5 rounded-full border transition-all duration-200"
        style={{
          backgroundColor: `${config.color}${priority === "none" ? "10" : "20"}`,
          borderColor: config.color,
          opacity: priority === "none" ? 0.4 : 0.8,
        }}
      />
      {showLabel && (
        <span style={{ color: config.color }} className="font-medium text-xs">
          {config.label}
        </span>
      )}
    </span>
  );
});

PriorityBadge.displayName = "PriorityBadge";

const TaskRowContent = ({
  task,
  currentUserId,
  currentUserAvatar,
  showLabelDetails,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onDeleteCard,
  onToggleLabelDetails,
  workspaceLabels,
  isDragging = false,
  isReadOnly,
}: {
  task: Task;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  showLabelDetails: boolean;
  onEditCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onToggleLabelDetails: (taskId: string) => void;
  workspaceLabels: any[];
  isDragging?: boolean;
  isReadOnly?: boolean;
}) => {
  const visibleLabels = useMemo(() => 
    (task.labels || [])
      .map((id: any) => workspaceLabels.find((t: any) => t._id === id || t.id === id))
      .filter(Boolean)
      .map((t: any) => ({ id: t._id || t.id, color: t.color, title: t.name }))
      .filter((l: any) => l.color),
  [task.labels, workspaceLabels]);

  const dueDateInfo = useMemo(() => {
    const hasDueDate = task.dueDate && isValidDate(task.dueDate);
    let overdueAt = hasDueDate ? isOverdue(task.dueDate) : false;
    if (task.dueState === "overdue") overdueAt = true;
    if (typeof task.isOverdue === "boolean") overdueAt = task.isOverdue;

    const startDateText = formatDueDate(task.startDate);
    const dueDateText = formatDueDate(task.dueDate);
    
    return {
      isOverdueAlert: overdueAt && !task.completed,
      displayText: startDateText && dueDateText
        ? `${startDateText} - ${dueDateText}`
        : dueDateText || startDateText,
      hasAnyDate: Boolean(dueDateText || startDateText)
    };
  }, [task.dueDate, task.startDate, task.dueState, task.isOverdue, task.completed]);

  const metadata = useMemo(() => {
    const hasDescription = Boolean(task.description?.trim() || task.content?.trim());
    const commentCount = task.commentCount ?? 0;
    const attachmentCount = Array.isArray(task.attachments) ? task.attachments.length : 0;
    const checklistItems = Array.isArray(task.checklists) ? task.checklists : [];
    const total = checklistItems.reduce((acc: any, cl: any) => acc + (Array.isArray(cl?.items) ? cl.items.length : 0), 0);
    const done = checklistItems.reduce((acc: any, cl: any) => acc + (Array.isArray(cl?.items) ? cl.items.filter((i: any) => i?.completed).length : 0), 0);

    return { hasDescription, commentCount, attachmentCount, checklistTotal: total, checklistDone: done };
  }, [task.description, task.content, task.commentCount, task.attachments, task.checklists]);

  const isCurrentUserAssignee = task.assigneeId?._id === currentUserId || (task.assigneeId as any)?.id === currentUserId;

  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted/30 transition-colors text-left group cursor-pointer border-b border-border/40 last:border-b-0 relative",
        task.completed && "opacity-75",
        isDragging && "z-50 bg-card border border-primary/40 opacity-90 rounded-lg"
      )}
    >
      <PriorityBadge priority={(task.priority as 'urgent' | 'high' | 'medium' | 'low' | 'none')} />

      <span className={cn(
        "text-xs font-medium flex-1 truncate transition-colors",
        task.completed ? "text-muted-foreground line-through" : "text-foreground"
      )}>
        {task.title}
      </span>

      {visibleLabels.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLabelDetails(task._id);
          }}
          className="flex items-center gap-1.5 shrink-0 text-left cursor-pointer"
          aria-label="Toggle label details"
        >
          {visibleLabels.slice(0, 3).map((label: any) => {
            const hasTitle = label.title?.trim().length > 0;
            return showLabelDetails ? (
              <span
                key={label.id}
                className="inline-flex h-4 items-center rounded px-1.5 text-[10px] font-semibold leading-none text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.title}
              </span>
            ) : (
              <span
                key={label.id}
                className="inline-flex h-2 w-7 rounded-full"
                style={{ backgroundColor: label.color }}
              />
            );
          })}
        </button>
      )}

      {dueDateInfo.hasAnyDate && (
        <span className={cn(
          "flex items-center gap-1 text-[11px] shrink-0 px-2 py-0.5 rounded transition-colors",
          dueDateInfo.isOverdueAlert 
            ? "bg-destructive/10 text-destructive font-medium" 
            : "text-muted-foreground"
        )}>
          <Clock3 className="size-3" />
          <span className="whitespace-nowrap">{dueDateInfo.displayText}</span>
        </span>
      )}

      <div className="flex items-center gap-2 text-muted-foreground transition-colors">
        {metadata.hasDescription && <AlignLeft className="size-3" />}
        {metadata.commentCount > 0 && (
          <div className="flex items-center gap-0.5 text-[11px]" title="Comments">
            <MessageSquare className="size-3" />
            <span>{metadata.commentCount}</span>
          </div>
        )}
        {metadata.attachmentCount > 0 && (
          <div className="flex items-center gap-0.5 text-[11px]" title="Attachments">
            <Paperclip className="size-3" />
            <span>{metadata.attachmentCount}</span>
          </div>
        )}
        {metadata.checklistTotal > 0 && (
          <div className="flex items-center gap-0.5 text-[11px]" title="Checklist progress">
            <CheckSquare className="size-3" />
            <span>{metadata.checklistDone}/{metadata.checklistTotal}</span>
          </div>
        )}
      </div>

      {task.assigneeId && (
        <Avatar className="size-5 shrink-0 border border-border/80 shadow-2xs">
          <AvatarImage
            src={isCurrentUserAssignee && !task.assigneeId.avatar ? currentUserAvatar : task.assigneeId.avatar}
          />
          <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
            {task.assigneeId.name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}

      {!isReadOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} className="w-44 rounded-lg p-1 text-xs">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateCard(task); }} className="cursor-pointer">
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            {currentUserId && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCurrentUserAssignee) {
                    onLeaveCard(task);
                  } else {
                    onJoinCard(task);
                  }
                }}
                className="cursor-pointer"
              >
                {isCurrentUserAssignee ? (
                  <>
                    <UserMinus className="mr-2 h-3.5 w-3.5" /> Leave
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-3.5 w-3.5" /> Join
                  </>
                )}
              </DropdownMenuItem>
            )}
            {onRemoveFromCycle && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemoveFromCycle(task); }} className="cursor-pointer">
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Remove from cycle
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDeleteCard(task); }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const SortableTaskRow = memo(({
  task,
  currentUserId,
  currentUserAvatar,
  showLabelDetails,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onDeleteCard,
  onToggleLabelDetails,
  workspaceLabels,
  isReadOnly,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: {
      type: "Task",
      task,
    },
    disabled: isReadOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEditCard(task)}
    >
      <TaskRowContent
        task={task}
        currentUserId={currentUserId}
        currentUserAvatar={currentUserAvatar}
        showLabelDetails={showLabelDetails}
        onEditCard={onEditCard}
        onDuplicateCard={onDuplicateCard}
        onJoinCard={onJoinCard}
        onLeaveCard={onLeaveCard}
        onRemoveFromCycle={onRemoveFromCycle}
        onDeleteCard={onDeleteCard}
        onToggleLabelDetails={onToggleLabelDetails}
        workspaceLabels={workspaceLabels}
        isDragging={isDragging}
        isReadOnly={isReadOnly}
      />
    </div>
  );
});

SortableTaskRow.displayName = "SortableTaskRow";

const ListViewColumn = ({ 
  group, 
  expandedIds, 
  toggleExpand, 
  setQuickAddColumnId, 
  isAddingCard, 
  currentUserId, 
  currentUserAvatar, 
  labelDetailsTaskIds, 
  onEditCard, 
  onDuplicateCard, 
  onJoinCard, 
  onLeaveCard, 
  onDeleteCard, 
  onRemoveFromCycle,
  toggleLabelDetails, 
  workspaceLabels, 
  quickAddColumnId, 
  quickAddInputRef, 
  quickAddTitle, 
  setQuickAddTitle, 
  handleQuickAddSubmit,
  isReadOnly
}: any) => {
  const { setNodeRef, isOver } = useDroppable({
    id: group.key,
  });

  const isExpanded = expandedIds.has(group.key);

  useEffect(() => {
    if (isOver && !isExpanded) {
      toggleExpand(group.key);
    }
  }, [isOver, isExpanded, group.key, toggleExpand]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border/70 bg-card overflow-hidden transition-all",
        isOver && "ring-2 ring-primary/30 border-primary/50"
      )}
    >
      {/* ── Group Header ── */}
      <div 
        className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors group cursor-pointer border-b border-border/50 select-none"
        onClick={() => toggleExpand(group.key)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
          <span className="text-xs font-semibold text-foreground tracking-tight">{group.label}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
            {group.items.length}
          </span>
        </div>

        {!isReadOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!isExpanded) {
                toggleExpand(group.key);
              }
              setQuickAddColumnId(group.key);
            }}
            disabled={isAddingCard}
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer rounded"
            aria-label="Add task"
          >
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>

      {/* ── Group Content ── */}
      {isExpanded && (
        <div>
          {group.items.length === 0 && quickAddColumnId !== group.key ? (
            <div className="py-5 text-center text-xs text-muted-foreground">
              <span>No tasks in {group.label}.</span>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setQuickAddColumnId(group.key)}
                  className="ml-1.5 text-primary hover:underline font-medium cursor-pointer"
                >
                  + Add task
                </button>
              )}
            </div>
          ) : (
            <SortableContext
              items={group.items.map((t: any) => t._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col divide-y divide-border/30">
                {group.items.map((task: any) => (
                  <SortableTaskRow
                    key={task._id}
                    task={task}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    showLabelDetails={labelDetailsTaskIds.has(task._id)}
                    onEditCard={onEditCard}
                    onDuplicateCard={onDuplicateCard}
                    onJoinCard={onJoinCard}
                    onLeaveCard={onLeaveCard}
                    onRemoveFromCycle={onRemoveFromCycle}
                    onDeleteCard={onDeleteCard}
                    onToggleLabelDetails={toggleLabelDetails}
                    workspaceLabels={workspaceLabels}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          {/* Quick Add Form */}
          {quickAddColumnId === group.key && (
            <div className="p-3 bg-muted/20 border-t border-border/40 space-y-2">
              <input
                ref={quickAddInputRef}
                type="text"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickAddSubmit(group.key);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setQuickAddColumnId(null);
                    setQuickAddTitle("");
                  }
                }}
                placeholder="What needs to be done?"
                className="h-8 w-full rounded-lg border border-border/80 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                disabled={isAddingCard}
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-[#0070f3] hover:bg-[#0060df] text-white rounded-md cursor-pointer"
                  onClick={() => handleQuickAddSubmit(group.key)}
                  disabled={!quickAddTitle.trim() || isAddingCard}
                >
                  Add task
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs rounded-md cursor-pointer"
                  onClick={() => {
                    setQuickAddColumnId(null);
                    setQuickAddTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* Main Component */
type ListViewProps = {
  tasksByColumnId: Map<string, Task[]>;
  columns: Column[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  isAddingCard?: boolean;
  projectId: string;
  isReadOnly?: boolean;
};

export default function ListView({
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
  onRemoveFromCycle,
  onMoveCard,
  isAddingCard,
  projectId,
  isReadOnly,
}: ListViewProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { data: workspaceLabels = [] } = useLabelsQuery(workspaceId || "", "task");
  const STORAGE_KEY = `flux.task.list.expanded.${projectId}`;

  // Expand all columns by default
  const defaultExpanded = useMemo(() => {
    return new Set(columns.map((c) => resolveTaskColumnId(c)));
  }, [columns]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return defaultExpanded;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : defaultExpanded;
    } catch {
      return defaultExpanded;
    }
  });

  const [labelDetailsTaskIds, setLabelDetailsTaskIds] = useState<Set<string>>(new Set());
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!quickAddColumnId) return;
    quickAddInputRef.current?.focus();
  }, [quickAddColumnId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedIds)));
  }, [expandedIds, STORAGE_KEY]);

  const handleQuickAddSubmit = (columnId: string) => {
    const trimmed = quickAddTitle.trim();
    if (!trimmed) return;
    setQuickAddTitle("");
    setQuickAddColumnId(null);
    onAddCard(columnId, trimmed);
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLabelDetails = (taskId: string) => {
    setLabelDetailsTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const getTargetColumnId = useCallback((overId: string) => {
    if (columns.some((col) => resolveTaskColumnId(col) === overId)) {
      return overId;
    }
    for (const [colId, tasks] of tasksByColumnId.entries()) {
      if (tasks.some(t => t._id === overId)) return colId;
    }
    return null;
  }, [columns, tasksByColumnId]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    const targetColumnId = getTargetColumnId(overId);

    if (targetColumnId) {
      const task = active.data.current?.task;
      if (task && task.columnId !== targetColumnId) {
        onMoveCard(taskId, targetColumnId);
      }
    }
  };

  const groups = useMemo(() =>
    columns.map((col) => {
      const columnId = resolveTaskColumnId(col);
      return {
        key: columnId,
        label: col.title,
        color: resolveTaskColumnColor(columnId, col.accentColor),
        items: tasksByColumnId.get(columnId) ?? [],
      };
    }),
  [columns, tasksByColumnId]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex-1 overflow-y-auto px-6 py-4 bg-background">
        <div className="w-full space-y-3 pb-8">
          {groups.map((group) => (
            <ListViewColumn
              key={group.key}
              group={group}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              setQuickAddColumnId={setQuickAddColumnId}
              isAddingCard={isAddingCard}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              labelDetailsTaskIds={labelDetailsTaskIds}
              onEditCard={onEditCard}
              onDuplicateCard={onDuplicateCard}
              onJoinCard={onJoinCard}
              onLeaveCard={onLeaveCard}
              onRemoveFromCycle={onRemoveFromCycle}
              onDeleteCard={onDeleteCard}
              toggleLabelDetails={toggleLabelDetails}
              workspaceLabels={workspaceLabels}
              quickAddColumnId={quickAddColumnId}
              quickAddInputRef={quickAddInputRef}
              quickAddTitle={quickAddTitle}
              setQuickAddTitle={setQuickAddTitle}
              handleQuickAddSubmit={handleQuickAddSubmit}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      </div>
      {isMounted && createPortal(
        <DragOverlay>
          {activeTask ? (
            <div className="w-[calc(100vw-400px)] max-w-2xl bg-card text-foreground border border-border/80 rounded-lg overflow-hidden">
              <TaskRowContent
                task={activeTask}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                showLabelDetails={labelDetailsTaskIds.has(activeTask._id)}
                onEditCard={() => {}}
                onDuplicateCard={() => {}}
                onJoinCard={() => {}}
                onLeaveCard={() => {}}
                onRemoveFromCycle={() => {}}
                onDeleteCard={() => {}}
                onToggleLabelDetails={() => {}}
                workspaceLabels={workspaceLabels}
                isDragging={true}
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
