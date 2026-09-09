'use client';

import { useState, useMemo, useEffect, memo, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  AlignLeft,
  CheckSquare,
  Clock3,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Pencil,
  RotateCcw,
  Trash2,
  UserMinus,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Bug,
  Sparkles,
  TrendingUp,
  Zap,
  Hash,
  ShieldAlert,
} from "lucide-react";
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  PRIORITY_CONFIG,
  ISSUE_TYPE_CONFIG,
  resolveTaskColumnColor,
  resolveWorkItemColumnColor,
  resolveWorkItemColumnId,
  resolveTaskColumnId,
  type Priority,
  type WorkItem,
  type Task,
  type Column,
  type TaskIssueType,
} from "../../types/work-item.types";

const ISSUE_TYPE_ICONS: Record<TaskIssueType, React.ElementType> = {
  task: CheckSquare,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  epic: Zap,
};
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
import { useLabelsQuery } from '../../hooks/use-work-item';
import { WorkItemHelpers, TaskHelpers } from '../../utils/work-item.util';
import { cn } from "@/shared/lib/utils";
import { createPortal } from "react-dom";
import { format, isValid } from "date-fns";

const isValidDate = (d: any) => {
  if (!d) return false;
  const parsed = new Date(d);
  return isValid(parsed);
};

const isOverdue = (d: any) => {
  if (!isValidDate(d)) return false;
  return new Date(d).getTime() < Date.now();
};

const formatDueDate = (d: any) => {
  if (!isValidDate(d)) return '';
  return format(new Date(d), 'MMM d');
};

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
      .map((id: any) => workspaceLabels.find((t: any) => t.id === id))
      .filter(Boolean)
      .map((t: any) => ({ id: t.id, color: t.color, title: t.name }))
      .filter((l: any) => l.color),
  [task.labels, workspaceLabels]);

  const dueDateInfo = useMemo(() => {
    const hasDueDate = Boolean(task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime()));
    let overdueAt = hasDueDate ? TaskHelpers.checkOverdue(task.dueDate) : false;
    if (task.dueState === "overdue") overdueAt = true;
    if (typeof task.isOverdue === "boolean") overdueAt = task.isOverdue;

    const startDateText = TaskHelpers.formatDate(task.startDate);
    const dueDateText = TaskHelpers.formatDate(task.dueDate);
    
    return {
      isOverdueAlert: overdueAt && !task.completed,
      displayText: startDateText && dueDateText
        ? `${startDateText} - ${dueDateText}`
        : dueDateText || startDateText || null,
      hasAnyDate: Boolean(dueDateText || startDateText),
    };
  }, [task.dueDate, task.startDate, task.dueState, task.isOverdue, task.completed]);

  const metadata = useMemo(() => {
    const hasDescription = Boolean(task.description?.trim() || task.content?.trim());
    const commentCount = task.commentCount ?? 0;
    const attachmentCount = Array.isArray(task.attachments) ? task.attachments.length : 0;
    const checklistItems = Array.isArray(task.checklists) ? task.checklists : [];
    const total = checklistItems.reduce((acc: any, cl: any) => acc + (Array.isArray(cl?.items) ? cl.items.length : 0), 0);
    const done = checklistItems.reduce((acc: any, cl: any) => acc + (Array.isArray(cl?.items) ? cl.items.filter((i: any) => i?.completed || i?.isCompleted).length : 0), 0);

    return { hasDescription, commentCount, attachmentCount, checklistTotal: total, checklistDone: done };
  }, [task.description, task.content, task.commentCount, task.attachments, task.checklists]);

  const assignee = (task as any).assignee || (typeof task.assigneeId === 'object' ? task.assigneeId : null);
  const assigneeId = assignee?.id || (typeof task.assigneeId === 'string' ? task.assigneeId : null);
  const isCurrentUserAssignee = Boolean(currentUserId && (assigneeId === currentUserId || assignee?.id === currentUserId));

  const iType = (task.issueType as TaskIssueType) || 'task';
  const isBlocked = Array.isArray(task.relations) && task.relations.some((r) => r.type === 'blocked_by');

  return (
    <div
      className={cn(
        "w-full flex items-center gap-2.5 px-4 py-2.5 bg-card hover:bg-muted transition-colors text-left group cursor-pointer border-b border-border last:border-b-0 relative",
        task.completed && "opacity-75",
        isDragging && "z-50 bg-card border border-primary opacity-90 rounded-md shadow-sm"
      )}
    >
      <PriorityBadge priority={(task.priority as 'urgent' | 'high' | 'medium' | 'low' | 'none')} />

      {/* Issue Type Icon */}
      {(() => {
        const Icon = ISSUE_TYPE_ICONS[iType] || CheckSquare;
        const config = ISSUE_TYPE_CONFIG[iType] || ISSUE_TYPE_CONFIG.task;
        return (
          <span className="shrink-0 inline-flex items-center" title={config.label}>
            <Icon className="size-3.5 shrink-0" style={{ color: config.color }} />
          </span>
        );
      })()}

      {/* Identifier */}
      {task.identifier && (
        <span className="font-mono text-11 font-semibold text-muted-foreground shrink-0">
          {task.identifier}
        </span>
      )}

      {/* Title */}
      <span className={cn(
        "text-xs font-medium flex-1 truncate transition-colors",
        task.completed ? "text-muted-foreground line-through" : "text-foreground"
      )}>
        {task.title}
      </span>

      {/* Blocked Warning */}
      {isBlocked && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-10 font-semibold bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 shrink-0">
          <ShieldAlert className="size-3 shrink-0" />
          <span>Blocked</span>
        </span>
      )}

      {/* Story Points */}
      {task.storyPoints !== undefined && task.storyPoints !== null && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-10 font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
          <Hash className="size-3 shrink-0" />
          <span>{task.storyPoints}</span>
        </span>
      )}

      {visibleLabels.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLabelDetails(task.id);
          }}
          className="flex items-center gap-1.5 shrink-0 text-left cursor-pointer"
          aria-label="Toggle label details"
        >
          {visibleLabels.slice(0, 3).map((label: any) => {
            const hasTitle = label.title?.trim().length > 0;
            return showLabelDetails ? (
              <span
                key={label.id}
                className="inline-flex h-4 items-center rounded-sm px-1.5 text-xs font-semibold leading-none text-white"
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
          "flex items-center gap-1 text-xs shrink-0 px-2 py-0.5 rounded-sm transition-colors",
          dueDateInfo.isOverdueAlert 
            ? "bg-destructive/10 text-destructive font-medium" 
            : "text-muted-foreground"
        )}>
          <Clock3 className="size-3 shrink-0" />
          <span className="whitespace-nowrap">{dueDateInfo.displayText}</span>
        </span>
      )}

      <div className="flex items-center gap-2 text-muted-foreground transition-colors">
        {metadata.hasDescription && <AlignLeft className="size-3 shrink-0" />}
        {metadata.commentCount > 0 && (
          <div className="flex items-center gap-0.5 text-xs" title="Comments">
            <MessageSquare className="size-3 shrink-0" />
            <span>{metadata.commentCount}</span>
          </div>
        )}
        {metadata.attachmentCount > 0 && (
          <div className="flex items-center gap-0.5 text-xs" title="Attachments">
            <Paperclip className="size-3 shrink-0" />
            <span>{metadata.attachmentCount}</span>
          </div>
        )}
        {metadata.checklistTotal > 0 && (
          <div className="flex items-center gap-0.5 text-xs" title="Checklist progress">
            <CheckSquare className="size-3 shrink-0" />
            <span>{metadata.checklistDone}/{metadata.checklistTotal}</span>
          </div>
        )}
      </div>

      {assignee && (
        <Avatar className="size-5 shrink-0 border border-border shadow-none">
          <AvatarImage
            src={isCurrentUserAssignee && !assignee.avatar ? currentUserAvatar : assignee.avatar}
          />
          <AvatarFallback className="text-10 font-medium bg-muted text-muted-foreground">
            {assignee.name?.charAt(0) || 'U'}
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
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md shadow-none"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} className="w-44 rounded-md border-border shadow-sm p-1 text-xs">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateCard(task); }} className="cursor-pointer">
              <Copy className="mr-2 h-3.5 w-3.5 shrink-0" /> Duplicate
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
                    <UserMinus className="mr-2 h-3.5 w-3.5 shrink-0" /> Leave
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-3.5 w-3.5 shrink-0" /> Join
                  </>
                )}
              </DropdownMenuItem>
            )}
            {onRemoveFromCycle && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemoveFromCycle(task); }} className="cursor-pointer">
                <RotateCcw className="mr-2 h-3.5 w-3.5 shrink-0" /> Remove from cycle
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDeleteCard(task); }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5 shrink-0" /> Delete
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
    id: task.id,
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
  onEditColumn,
  onDeleteColumn,
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
        "rounded-md border border-border bg-card overflow-hidden transition-all",
        isOver && "ring-1 ring-primary border-primary"
      )}
    >
      {/* ── Group Header ── */}
      <div 
        className="flex items-center justify-between px-3.5 py-2.5 bg-muted hover:bg-muted transition-colors group cursor-pointer border-b border-border select-none"
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
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
            {group.items.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
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
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md shadow-none"
              aria-label="Add task"
            >
              <Plus className="size-3.5 shrink-0" />
            </Button>
          )}

          {!isReadOnly && (onEditColumn || onDeleteColumn) && group.column && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md shadow-none"
                  aria-label="Status options"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-md border-border shadow-sm text-xs z-50">
                {onEditColumn && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditColumn(group.column);
                    }}
                    className="cursor-pointer gap-2 py-1.5"
                  >
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>Edit status</span>
                  </DropdownMenuItem>
                )}
                {onDeleteColumn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteColumn(group.column);
                      }}
                      className="cursor-pointer gap-2 py-1.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5 shrink-0" />
                      <span>Delete status</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
              items={group.items.map((t: any) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col divide-y divide-border">
                {group.items.map((task: any) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    showLabelDetails={labelDetailsTaskIds.has(task.id)}
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
            <div className="p-3 bg-muted border-t border-border space-y-2">
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
                className="h-8 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
                disabled={isAddingCard}
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md cursor-pointer shadow-none"
                  onClick={() => handleQuickAddSubmit(group.key)}
                  disabled={!quickAddTitle.trim() || isAddingCard}
                >
                  Add work item
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs rounded-md cursor-pointer shadow-none"
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
  onAddColumn?: () => void;
  onEditColumn?: (column: Column) => void;
  onDeleteColumn?: (column: Column) => void;
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
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set<string>(parsed.filter((item): item is string => typeof item === "string"));
        }
      }
      return defaultExpanded;
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
    for (const [columnId, tasks] of tasksByColumnId.entries()) {
      if (tasks.some(t => t.id === overId)) return columnId;
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
        column: col,
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
              onEditColumn={onEditColumn}
              onDeleteColumn={onDeleteColumn}
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

          {!isReadOnly && onAddColumn && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onAddColumn}
                className="w-full h-9 border border-dashed border-border hover:border-primary hover:bg-muted rounded-md flex items-center justify-center gap-1.5 text-13 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-background shadow-none"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>Add status / column</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {isMounted && createPortal(
        <DragOverlay>
          {activeTask ? (
            <div className="w-[calc(100vw-400px)] max-w-2xl bg-card text-foreground border border-border rounded-md shadow-sm overflow-hidden">
              <TaskRowContent
                task={activeTask}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                showLabelDetails={labelDetailsTaskIds.has(activeTask.id)}
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
