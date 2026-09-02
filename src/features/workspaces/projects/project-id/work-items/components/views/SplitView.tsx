'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  UserPlus,
  UserMinus,
  RotateCcw,
  Clock,
  Check,
  CheckSquare,
  Sparkles,
  Bug,
  TrendingUp,
  Zap,
  Tag,
  AlertCircle,
  Minus,
  CircleSlash,
  Maximize2,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { Task, Column as ColumnType, TaskPriority, TaskIssueType, TaskMutationInput } from '../../types/work-item.types';
import { ISSUE_TYPE_CONFIG, resolveTaskColumnId, resolveTaskColumnColor } from '../../types/work-item.types';
import { TaskHelpers } from '../../utils/work-item.util';
import { PriorityPopover } from '../modals/work-item/popovers/PriorityPopover';
import { TaskTypePopover } from '../modals/work-item/popovers/TaskTypePopover';
import { StoryPointsPopover } from '../modals/work-item/popovers/StoryPointsPopover';
import { MemberPopover } from '../modals/work-item/popovers/MemberPopover';
import { LabelPopover } from '../modals/work-item/popovers/LabelPopover';
import { DatePopover } from '../modals/work-item/popovers/DatePopover';
import { WorkItemActivities as TaskActivities } from '../modals/work-item/WorkItemActivities';
import { TaskRelations } from '../modals/work-item/TaskRelations';
import { WorkItemChecklist as TaskChecklist } from '../modals/work-item/WorkItemChecklist';
import { useTaskComments, useAddComment, useDeleteComment, useTaskActivityLogs } from '../../hooks/use-work-item';

export interface SplitViewProps {
  tasks: Task[];
  columns: ColumnType[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  projectId?: string;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (card: Task) => void;
  onDeleteCard: (card: Task) => void;
  onDuplicateCard: (card: Task) => void;
  onJoinCard: (card: Task) => void;
  onLeaveCard: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onSaveCard?: (card: TaskMutationInput) => void;
  isReadOnly?: boolean;
}

const ISSUE_TYPE_ICONS: Record<TaskIssueType, React.ElementType> = {
  task: CheckSquare,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  epic: Zap,
};

const PRIORITY_ICONS: Record<TaskPriority, { icon: React.ElementType; color: string; label: string }> = {
  urgent: { icon: AlertCircle, color: 'text-red-500', label: 'Urgent' },
  high: { icon: ArrowUpIcon, color: 'text-orange-500', label: 'High' },
  medium: { icon: Minus, color: 'text-amber-500', label: 'Medium' },
  low: { icon: ArrowDownIcon, color: 'text-blue-500', label: 'Low' },
  none: { icon: CircleSlash, color: 'text-muted-foreground/60', label: 'None' },
};

function ArrowUpIcon(props: any) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  );
}

function ArrowDownIcon(props: any) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

export function SplitView({
  tasks = [],
  columns = [],
  currentUserId,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onMoveCard,
  isReadOnly = false,
}: SplitViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Popover States for Right Pane
  const [openTypePopover, setOpenTypePopover] = useState(false);
  const [openStoryPointsPopover, setOpenStoryPointsPopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openDatePopover, setOpenDatePopover] = useState(false);
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [commentText, setCommentText] = useState('');

  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnType>();
    columns.forEach((c) => map.set(resolveTaskColumnId(c), c));
    return map;
  }, [columns]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !searchQuery.trim() ||
        (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.identifier || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.columnId === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  const activeTask = useMemo(() => {
    if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return filteredTasks[0] || null;
  }, [tasks, selectedTaskId, filteredTasks]);

  // Comment & Activity Queries for Active Task
  const { data: taskComments = [] } = useTaskComments(activeTask?.id ? activeTask.id : '');
  const { data: taskActivity = [], isLoading: activityLoading, error: activityError } = useTaskActivityLogs(
    activeTask?.id ? activeTask.id : ''
  );
  const createCommentMutation = useAddComment();
  const deleteCommentMutation = useDeleteComment();

  const visibleActivities = useMemo(() => {
    const commentsList = Array.isArray(taskComments)
      ? taskComments
      : (taskComments as any)?.comments || (taskComments as any)?.data || [];
    const commentEntries = commentsList.map((c: any) => ({
      id: c.id,
      kind: 'comment' as const,
      author: c.author?.name || 'User',
      avatarUrl: c.author?.avatar,
      authorInitials: TaskHelpers.getInitials(c.author?.name),
      content: c.content || '',
      timestamp: TaskHelpers.formatActivityTime(c.createdAt),
      createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      permissions: { canEdit: true, canDelete: true },
    }));

    const activityList = Array.isArray(taskActivity)
      ? taskActivity
      : (taskActivity as any)?.activity || (taskActivity as any)?.activities || (taskActivity as any)?.data || [];
    const logEntries = activityList.map((a: any) => ({
      id: a.id || `log_${Math.random()}`,
      kind: 'activity' as const,
      author: a.user?.name || a.author?.name || 'System',
      avatarUrl: a.user?.avatar || a.author?.avatar,
      authorInitials: TaskHelpers.getInitials(a.user?.name || a.author?.name),
      content: a.message || a.action || 'updated this task',
      timestamp: TaskHelpers.formatActivityTime(a.createdAt),
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
    }));

    return [...commentEntries, ...logEntries].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }, [taskComments, taskActivity]);

  const handleCopyBranch = (task: Task) => {
    const branch = TaskHelpers.generateGitBranchName(task.identifier, task.title);
    navigator.clipboard.writeText(`git checkout -b ${branch}`);
    toast.success(`Copied git branch: ${branch}`);
  };

  const actionBtnClass =
    'h-6.5 px-2 text-[11px] font-medium rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/60 shadow-none flex items-center gap-1 transition-colors cursor-pointer shrink-0';

  return (
    <div className="flex-1 min-h-0 h-full flex bg-background text-foreground overflow-hidden border-t border-border/50">
      {/* ── Left Pane: Master Task List ────────────────────────────────────────── */}
      <div className="w-80 sm:w-96 border-r border-border/70 flex flex-col min-h-0 bg-muted/10 shrink-0">
        {/* Left Header / Filter Bar */}
        <div className="p-3 border-b border-border/60 space-y-2 shrink-0 bg-background/50 backdrop-blur-xs">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border/60 rounded-md text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-6.5 text-[11px] font-medium w-36 border-border/60 bg-muted/40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All Status ({tasks.length})</SelectItem>
                {columns.map((c) => {
                  const id = resolveTaskColumnId(c);
                  const count = tasks.filter((t) => t.columnId === id).length;
                  return (
                    <SelectItem key={id} value={id}>
                      {c.title} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <span className="text-[11px] text-muted-foreground font-medium">
              {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Task List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredTasks.map((task) => {
            const isSelected = activeTask?.id === task.id;
            const col = columnMap.get(task.columnId);
            const colColor = resolveTaskColumnColor(task.columnId, col?.accentColor);
            const issueType = (task.issueType as TaskIssueType) || 'task';
            const TypeIcon = ISSUE_TYPE_ICONS[issueType] || CheckSquare;
            const typeCfg = ISSUE_TYPE_CONFIG[issueType] || ISSUE_TYPE_CONFIG.task;
            const priority = task.priority || 'none';
            const priorityCfg = PRIORITY_ICONS[priority] || PRIORITY_ICONS.none;
            const PriorityIcon = priorityCfg.icon;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={cn(
                  'p-3 cursor-pointer transition-all hover:bg-muted/50 text-left relative group',
                  isSelected && 'bg-primary/10 hover:bg-primary/15 border-l-3 border-primary'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <TypeIcon className="size-3.5 shrink-0" style={{ color: typeCfg.color }} />
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">
                      {task.identifier || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: colColor }}
                      title={col?.title || task.columnId}
                    />
                    <PriorityIcon className={cn('size-3 shrink-0', priorityCfg.color)} />
                  </div>
                </div>

                <h4 className={cn('text-xs font-semibold line-clamp-2 leading-snug', isSelected ? 'text-primary font-bold' : 'text-foreground')}>
                  {task.title}
                </h4>

                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const assignee = typeof task.assigneeId === 'object' ? task.assigneeId : (task as any).assignee;
                      if (!assignee) return <span className="italic opacity-60">Unassigned</span>;
                      return (
                        <span className="truncate max-w-[120px] font-medium text-foreground/80">
                          {assignee.name || 'Member'}
                        </span>
                      );
                    })()}
                  </div>

                  {task.dueDate && (
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-2.5" />
                      {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No tasks match the filter.
            </div>
          )}
        </div>
      </div>

      {/* ── Right Pane: Detail View ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden">
        {activeTask ? (
          <>
            {/* Header Toolbar */}
            <div className="px-5 py-2.5 border-b border-border/70 flex items-center justify-between gap-2 shrink-0 bg-background/80 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {/* Status */}
                {(() => {
                  const activeCol = columnMap.get(activeTask.columnId);
                  const activeColColor = resolveTaskColumnColor(activeTask.columnId, activeCol?.accentColor);
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          className="h-6.5 text-[11px] font-semibold border border-border/60 bg-muted/50 hover:bg-muted rounded-md px-2 gap-1.5 flex items-center shadow-none transition-colors cursor-pointer outline-none min-w-20"
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: activeColColor }}
                          />
                          <span className="truncate">{activeCol?.title || activeTask.columnId}</span>
                          <ChevronDown className="size-3 text-muted-foreground opacity-60 ml-0.5 shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={4} className="w-44 p-1 text-xs z-50">
                        {columns.map((c) => {
                          const cId = resolveTaskColumnId(c);
                          const color = resolveTaskColumnColor(cId, c.accentColor);
                          const isCurrent = activeTask.columnId === cId;
                          return (
                            <DropdownMenuItem
                              key={cId}
                              onClick={() => onMoveCard(activeTask.id, cId)}
                              className={cn(
                                "flex items-center gap-2 cursor-pointer text-xs py-1.5",
                                isCurrent && "bg-primary/10 font-semibold text-primary"
                              )}
                            >
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="flex-1 truncate">{c.title}</span>
                              {isCurrent && <Check className="size-3.5 text-primary ml-auto" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}

                {/* Priority */}
                <PriorityPopover
                  open={openPriorityPopover}
                  onOpenChange={setOpenPriorityPopover}
                  priority={activeTask.priority || 'none'}
                  setPriority={() => {}}
                  actionBtnClass={actionBtnClass}
                />

                {/* Type */}
                <TaskTypePopover
                  open={openTypePopover}
                  onOpenChange={setOpenTypePopover}
                  issueType={(activeTask.issueType as TaskIssueType) || 'task'}
                  setIssueType={() => {}}
                  actionBtnClass={actionBtnClass}
                />

                {/* Story Points */}
                <StoryPointsPopover
                  open={openStoryPointsPopover}
                  onOpenChange={setOpenStoryPointsPopover}
                  storyPoints={activeTask.storyPoints}
                  setStoryPoints={() => {}}
                  actionBtnClass={actionBtnClass}
                />

                {/* Identifier & Git Branch */}
                {activeTask.identifier && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeTask.identifier || '');
                      toast.success(`Copied: ${activeTask.identifier}`);
                    }}
                    className="font-mono text-[11px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    {activeTask.identifier}
                  </button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyBranch(activeTask)}
                  className="h-6.5 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Terminal className="size-3 text-emerald-500" />
                  <span className="hidden sm:inline">Copy Branch</span>
                </Button>
              </div>

              {/* Actions: Open Full Modal */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => onEditCard(activeTask)}
                  title="Open full modal dialog"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Split Content Grid: Left Main Details / Right Comments */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 p-5 items-start">
                {/* Left: Task Title, Description, Checklists */}
                <div className="min-w-0 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      {activeTask.title}
                    </h2>
                  </div>

                  {/* Assignee & Dates Summary */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {(() => {
                      const assignee = typeof activeTask.assigneeId === 'object' ? activeTask.assigneeId : (activeTask as any).assignee;
                      if (!assignee) {
                        return (
                          <div className="text-muted-foreground italic text-xs bg-muted/30 px-2 py-1 rounded border border-border/40">
                            No assignee
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-1 rounded-md border border-border/50">
                          <Avatar className="size-4">
                            <AvatarImage src={assignee.avatar} />
                            <AvatarFallback className="text-[8px] font-bold">
                              {TaskHelpers.getInitials(assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground">{assignee.name || 'Member'}</span>
                        </div>
                      );
                    })()}

                    {activeTask.dueDate && (
                      <div className="flex items-center gap-1 text-xs bg-muted/60 px-2 py-1 rounded-md border border-border/50">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>Due {new Date(activeTask.dueDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Description
                    </label>
                    <div className="p-3 rounded-md border border-border/70 bg-muted/10 text-xs text-foreground leading-relaxed min-h-[80px] whitespace-pre-wrap">
                      {activeTask.description || activeTask.content || (
                        <span className="italic text-muted-foreground/60">No description provided.</span>
                      )}
                    </div>
                  </div>

                  {/* Checklists */}
                  {activeTask.checklists && activeTask.checklists.length > 0 && (
                    <TaskChecklist
                      checklists={activeTask.checklists}
                      onDeleteChecklist={() => {}}
                      onToggleItem={() => {}}
                      onDeleteItem={() => {}}
                      onUpdateItem={() => {}}
                      onAddItem={() => {}}
                      isReadOnly={isReadOnly}
                    />
                  )}

                  {/* Relations */}
                  {activeTask.relations && activeTask.relations.length > 0 && (
                    <TaskRelations
                      relations={activeTask.relations}
                      currentTaskId={activeTask.id}
                      onAddRelation={() => {}}
                      onRemoveRelation={() => {}}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>

                {/* Right: Comments & Activities Panel */}
                <div className="border-t lg:border-t-0 lg:border-l border-border/70 pt-4 lg:pt-0 lg:pl-5 sticky top-0">
                  <TaskActivities
                    commentText={commentText}
                    setCommentText={setCommentText}
                    onSaveComment={(text) => {
                      if (!activeTask?.id || !text.trim()) return;
                      createCommentMutation.mutate({ taskId: activeTask.id, content: text.trim() });
                      setCommentText('');
                    }}
                    onUpdateComment={() => {}}
                    onDeleteComment={(commentId) => {
                      if (!activeTask?.id) return;
                      deleteCommentMutation.mutate({ taskId: activeTask.id, commentId });
                    }}
                    onReactComment={() => {}}
                    canComment={Boolean(activeTask?.id)}
                    showDetailActivity={showDetailActivity}
                    setShowDetailActivity={setShowDetailActivity}
                    activityLoading={activityLoading}
                    activityError={Boolean(activityError)}
                    activities={visibleActivities}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <CheckSquare className="size-10 opacity-30 mb-2" />
            <p className="text-sm font-semibold">Select a task from the list</p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              Click on any task on the left to view and interact with its full details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SplitView;
