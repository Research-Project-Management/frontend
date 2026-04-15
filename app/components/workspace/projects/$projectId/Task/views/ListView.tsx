import { useState, useMemo, useEffect, memo, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  Clock3,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  PRIORITY_CONFIG,
  resolveTaskColumnColor,
  resolveTaskColumnId,
  resolveTaskLabels,
  type Priority,
  type Task,
  type Column,
} from "~/types/task";

/* Helper Functions */
function isValidDate(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isOverdue(value?: string) {
  if (!isValidDate(value)) return false;
  const date = new Date(value!);
  return date.getTime() < new Date().setHours(0, 0, 0, 0);
}

function formatDueDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
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
        className="size-2.5 rounded-full border transition-all duration-200 group-hover:scale-110 group-hover:opacity-100"
        style={{
          backgroundColor: `${config.color}${priority === "none" ? "10" : "20"}`,
          borderColor: config.color,
          opacity: priority === "none" ? 0.4 : 0.8,
        }}
      />
      {showLabel && (
        <span style={{ color: config.color }} className="font-medium">
          {config.label}
        </span>
      )}
    </span>
  );
});

PriorityBadge.displayName = "PriorityBadge";

const TaskRow = memo(({
  task,
  currentUserId,
  currentUserAvatar,
  showLabelDetails,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onDeleteCard,
  onToggleLabelDetails,
}: {
  task: Task;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  showLabelDetails: boolean;
  onEditCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onToggleLabelDetails: (taskId: string) => void;
}) => {
  const visibleLabels = useMemo(() => 
    resolveTaskLabels(task.labels || []).filter((l) => l.color),
  [task.labels]);

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
    const attachmentCount = task.attachments?.length ?? 0;
    const checklistItems = task.checklists ?? [];
    const total = checklistItems.reduce((acc, cl) => acc + cl.items.length, 0);
    const done = checklistItems.reduce((acc, cl) => acc + cl.items.filter(i => i.completed).length, 0);

    return { hasDescription, commentCount, attachmentCount, checklistTotal: total, checklistDone: done };
  }, [task.description, task.content, task.commentCount, task.attachments, task.checklists]);

  const isCurrentUserAssignee = task.assignee?._id === currentUserId;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEditCard(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEditCard(task);
        }
      }}
      className={`w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-zinc-50/80 transition-all text-left group cursor-pointer focus:outline-none focus-visible:bg-zinc-50 border-l-2 border-l-transparent border-b border-border/40 relative ${
        task.completed ? "hover:border-emerald-500/50" : "hover:border-zinc-900/10"
      }`}
    >
      <PriorityBadge priority={task.priority} />

      <span className={`text-sm flex-1 truncate transition-all duration-200 ${
        task.completed ? "text-zinc-400 line-through" : "text-foreground group-hover:text-black"
      }`}>
        {task.title}
      </span>

      {visibleLabels.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLabelDetails(task._id);
          }}
          className="flex items-center gap-1.5 shrink-0 text-left"
          aria-label="Toggle label details"
        >
          {visibleLabels.slice(0, 3).map((label) => {
            const hasTitle = label.title.trim().length > 0;
            return showLabelDetails ? (
              <span
                key={label.id}
                className="inline-flex h-4 items-center rounded-sm px-2 text-[10px] font-semibold leading-none text-zinc-900 animate-in fade-in zoom-in-95 duration-200"
                style={{ backgroundColor: label.color, minWidth: hasTitle ? "auto" : "3rem", maxWidth: "30rem" }}
              >
                {hasTitle && <span className="max-w-30 truncate">{label.title}</span>}
              </span>
            ) : (
              <span
                key={label.id}
                className="inline-flex h-2.5 w-11 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                style={{ backgroundColor: label.color }}
              />
            );
          })}
        </button>
      )}

      {dueDateInfo.hasAnyDate && (
        <span className={`flex items-center gap-1 text-[11px] shrink-0 px-2 py-1 rounded-sm transition-all duration-200 ${
          dueDateInfo.isOverdueAlert 
            ? "bg-[#c9372c] text-white font-semibold shadow-sm" 
            : "text-muted-foreground group-hover:text-zinc-600"
        }`}>
          <Clock3 className="size-3" />
          <span className="whitespace-nowrap">{dueDateInfo.displayText}</span>
        </span>
      )}

      <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-500 transition-colors">
        {metadata.hasDescription && <AlignLeft className="size-3"/>}
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

      {task.assignee && (
        <Avatar className="size-5 shrink-0 border border-white shadow-sm transition-transform group-hover:scale-110">
          <AvatarImage
            src={isCurrentUserAssignee && !task.assignee.avatar ? currentUserAvatar : task.assignee.avatar}
          />
          <AvatarFallback className="text-[9px] font-bold bg-zinc-100">
            {task.assignee.name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-100 hover:bg-zinc-200/50 transition-opacity"
            aria-label="More actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-sm animate-in fade-in zoom-in-95 duration-200">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateCard(task); }}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          {currentUserId && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                isCurrentUserAssignee ? onLeaveCard(task) : onJoinCard(task);
              }}
              disabled={task.permissions?.canEdit === false}
            >
              {isCurrentUserAssignee ? <UserMinus className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {isCurrentUserAssignee ? "Leave" : "Join"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDeleteCard(task); }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

TaskRow.displayName = "TaskRow";

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
  isAddingCard?: boolean;
  projectId: string;
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
  isAddingCard,
  projectId,
}: ListViewProps) {
  const STORAGE_KEY = `flux.task.list.expanded.${projectId}`;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [labelDetailsTaskIds, setLabelDetailsTaskIds] = useState<Set<string>>(new Set());
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);

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

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const toggleLabelDetails = (taskId: string) => {
    setLabelDetailsTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
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
    <div className="flex min-h-full flex-col bg-background mt-2 pb-8">
      <div className="border border-border/80 overflow-hidden flex flex-col divide-y divide-border/80">
        {groups.map((group) => {
          const isExpanded = expandedIds.has(group.key);
          return (
            <div key={group.key} className="flex flex-col bg-[#f4f5f7]">
              <div 
                className="flex items-center gap-2 px-3 py-2.5 transition-colors group cursor-pointer hover:bg-zinc-200/50"
                onClick={() => toggleExpand(group.key)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="text-[13.5px] font-semibold text-zinc-900">{group.label}</span>
                  <span className="text-[12px] text-zinc-400 font-normal">{group.items.length}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (!expandedIds.has(group.key)) {
                      toggleExpand(group.key);
                    }
                    setQuickAddColumnId(group.key);
                  }}
                  disabled={isAddingCard}
                  className="h-7 w-7 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/50"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              {isExpanded && (
                <div className="bg-white border-t border-border/60">
                  <div className="flex flex-col">
                    {group.items.map((task) => (
                      <TaskRow
                        key={task._id}
                        task={task}
                        currentUserId={currentUserId}
                        currentUserAvatar={currentUserAvatar}
                        showLabelDetails={labelDetailsTaskIds.has(task._id)}
                        onEditCard={onEditCard}
                        onDuplicateCard={onDuplicateCard}
                        onJoinCard={onJoinCard}
                        onLeaveCard={onLeaveCard}
                        onDeleteCard={onDeleteCard}
                        onToggleLabelDetails={toggleLabelDetails}
                      />
                    ))}

                    {quickAddColumnId === group.key && (
                      <div className="bg-white border-b border-border/40">
                        <div className="border-t border-border/40">
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
                            className="h-10 w-full border-0 bg-transparent px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500"
                            disabled={isAddingCard}
                          />
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-transparent">
                            <Button
                              size="sm"
                              className="h-7 rounded-sm bg-black px-3 text-white hover:bg-black/90"
                              onClick={() => handleQuickAddSubmit(group.key)}
                              disabled={!quickAddTitle.trim() || isAddingCard}
                            >
                              {isAddingCard ? "Adding..." : "Add"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-sm px-2 text-zinc-600 hover:bg-zinc-100"
                              onClick={() => {
                                setQuickAddColumnId(null);
                                setQuickAddTitle("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
