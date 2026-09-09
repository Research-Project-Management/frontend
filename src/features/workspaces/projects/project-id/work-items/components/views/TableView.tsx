'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  UserPlus,
  UserMinus,
  RotateCcw,
  Clock,
  Hash,
  Sparkles,
  Bug,
  CheckSquare,
  TrendingUp,
  Zap,
  Tag,
  AlertCircle,
  Minus,
  CircleSlash,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import type { Task, Column as ColumnType, TaskPriority, TaskIssueType } from '../../types/work-item.types';
import { ISSUE_TYPE_CONFIG, resolveTaskColumnId, resolveTaskColumnColor } from '../../types/work-item.types';
import { TaskHelpers } from '../../utils/work-item.util';

export interface TableViewProps {
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
  isReadOnly?: boolean;
}

type SortField = 'identifier' | 'title' | 'status' | 'priority' | 'type' | 'dueDate' | 'storyPoints';
type SortOrder = 'asc' | 'desc';

const ISSUE_TYPE_ICONS: Record<TaskIssueType, React.ElementType> = {
  task: CheckSquare,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  epic: Zap,
};

const PRIORITY_ICONS: Record<TaskPriority, { icon: React.ElementType; color: string; label: string }> = {
  urgent: { icon: AlertCircle, color: 'text-red-500', label: 'Urgent' },
  high: { icon: ArrowUp, color: 'text-orange-500', label: 'High' },
  medium: { icon: Minus, color: 'text-amber-500', label: 'Medium' },
  low: { icon: ArrowDown, color: 'text-blue-500', label: 'Low' },
  none: { icon: CircleSlash, color: 'text-muted-foreground', label: 'None' },
};

export function TableView({
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
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('identifier');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColumnId, setNewColumnId] = useState<string>(
    columns.length > 0 ? resolveTaskColumnId(columns[0]) : 'todo'
  );

  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnType>();
    columns.forEach((c) => map.set(resolveTaskColumnId(c), c));
    return map;
  }, [columns]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'identifier':
          valA = a.identifier || '';
          valB = b.identifier || '';
          break;
        case 'title':
          valA = (a.title || '').toLowerCase();
          valB = (b.title || '').toLowerCase();
          break;
        case 'status':
          valA = columnMap.get(a.columnId)?.title || a.columnId || '';
          valB = columnMap.get(b.columnId)?.title || b.columnId || '';
          break;
        case 'priority': {
          const priorityWeights: Record<TaskPriority, number> = {
            urgent: 4,
            high: 3,
            medium: 2,
            low: 1,
            none: 0,
          };
          valA = priorityWeights[a.priority || 'none'] || 0;
          valB = priorityWeights[b.priority || 'none'] || 0;
          break;
        }
        case 'type':
          valA = a.issueType || 'task';
          valB = b.issueType || 'task';
          break;
        case 'dueDate':
          valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'storyPoints':
          valA = a.storyPoints ?? -1;
          valB = b.storyPoints ?? -1;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortOrder, columnMap]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(sortedTasks.map((t) => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddCard(newColumnId, newTitle.trim());
    setNewTitle('');
    setIsAddingNew(false);
  };

  const allSelected = sortedTasks.length > 0 && selectedTaskIds.length === sortedTasks.length;
  const someSelected = selectedTaskIds.length > 0 && !allSelected;

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Table Container */}
      <div className="flex-1 overflow-auto border-t border-border">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="sticky top-0 z-20 bg-muted border-b border-border select-none">
            <tr className="h-9 font-semibold text-muted-foreground">
              <th className="w-9 px-3 text-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className="size-3.5"
                />
              </th>

              <th
                onClick={() => handleSort('identifier')}
                className="w-24 px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>ID</span>
                  {sortField === 'identifier' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('type')}
                className="w-24 px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Type</span>
                  {sortField === 'type' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('title')}
                className="min-w-[220px] px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  {sortField === 'title' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('status')}
                className="w-32 px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {sortField === 'status' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('priority')}
                className="w-28 px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  {sortField === 'priority' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th className="w-36 px-2.5">Assignee</th>

              <th
                onClick={() => handleSort('storyPoints')}
                className="w-20 px-2.5 cursor-pointer hover:text-foreground transition-colors text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Pts</span>
                  {sortField === 'storyPoints' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('dueDate')}
                className="w-28 px-2.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Due Date</span>
                  {sortField === 'dueDate' ? (
                    sortOrder === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30 shrink-0" />
                  )}
                </div>
              </th>

              <th className="w-12 px-2 text-center">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border">
            {sortedTasks.map((task) => {
              const isSelected = selectedTaskIds.includes(task.id);
              const col = columnMap.get(task.columnId);
              const colColor = resolveTaskColumnColor(task.columnId, col?.accentColor);
              const issueType = (task.issueType as TaskIssueType) || 'task';
              const typeCfg = ISSUE_TYPE_CONFIG[issueType] || ISSUE_TYPE_CONFIG.task;
              const TypeIcon = ISSUE_TYPE_ICONS[issueType] || CheckSquare;
              const priority = task.priority || 'none';
              const priorityCfg = PRIORITY_ICONS[priority] || PRIORITY_ICONS.none;
              const PriorityIcon = priorityCfg.icon;
              const isOverdue = TaskHelpers.checkOverdue(task.dueDate);
              const assignee = typeof task.assigneeId === 'object' ? task.assigneeId : (task as any).assignee;
              const assigneeIdStr = assignee?.id || (typeof task.assigneeId === 'string' ? task.assigneeId : null);
              const isCurrentUser = Boolean(currentUserId && assigneeIdStr === currentUserId);

              return (
                <tr
                  key={task.id}
                  onClick={() => onEditCard(task)}
                  className={cn(
                    'h-10 hover:bg-muted cursor-pointer transition-colors group',
                    isSelected && 'bg-muted'
                  )}
                >
                  {/* Selection Checkbox */}
                  <td
                    className="px-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(task.id);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSelect(task.id)}
                      className="size-3.5"
                    />
                  </td>

                  {/* Identifier */}
                  <td className="px-2.5 font-mono text-11 font-bold text-muted-foreground group-hover:text-foreground">
                    {task.identifier || '—'}
                  </td>

                  {/* Issue Type */}
                  <td className="px-2.5">
                    <div className="flex items-center gap-1 text-11 font-medium">
                      <TypeIcon className="size-3.5 shrink-0" style={{ color: typeCfg.color }} />
                      <span className="truncate">{typeCfg.label}</span>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="px-2.5">
                    <span className="font-semibold text-foreground truncate block max-w-[340px]">
                      {task.title}
                    </span>
                  </td>

                  {/* Status Dropdown */}
                  <td
                    className="px-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={isReadOnly}
                          className="h-6.5 text-11 font-semibold border border-border bg-muted hover:bg-muted rounded-md px-2 gap-1.5 flex items-center shadow-none transition-colors cursor-pointer outline-none max-w-[130px]"
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: colColor }}
                          />
                          <span className="truncate">{col?.title || task.columnId}</span>
                          <ChevronDown className="size-3 text-muted-foreground ml-0.5 shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={4} className="w-44 p-1 text-xs z-50">
                        {columns.map((c) => {
                          const cId = resolveTaskColumnId(c);
                          const color = resolveTaskColumnColor(cId, c.accentColor);
                          const isCurrent = task.columnId === cId;
                          return (
                            <DropdownMenuItem
                              key={cId}
                              onClick={() => onMoveCard(task.id, cId)}
                              className={cn(
                                "flex items-center gap-2 cursor-pointer text-xs py-1.5",
                                isCurrent && "bg-muted font-semibold text-foreground"
                              )}
                            >
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="flex-1 truncate">{c.title}</span>
                              {isCurrent && <Check className="size-3.5 text-foreground ml-auto shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>

                  {/* Priority */}
                  <td className="px-2.5">
                    <div className="flex items-center gap-1 text-11 font-medium">
                      <PriorityIcon className={cn('size-3.5 shrink-0', priorityCfg.color)} />
                      <span>{priorityCfg.label}</span>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-2.5">
                    {assignee ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="size-4.5 shrink-0">
                          <AvatarImage src={assignee.avatar} />
                          <AvatarFallback className="text-9 font-bold">
                            {TaskHelpers.getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-11 font-medium text-foreground">
                          {assignee.name || 'Member'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-11 text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>

                  {/* Story Points */}
                  <td className="px-2.5 text-center">
                    {task.storyPoints !== undefined && task.storyPoints !== null ? (
                      <span className="inline-flex items-center justify-center font-mono font-bold text-10 px-1.5 py-0.5 rounded-sm bg-muted text-foreground border border-border">
                        {task.storyPoints}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="px-2.5">
                    {task.dueDate ? (
                      <div
                        className={cn(
                          'flex items-center gap-1 text-11 font-medium',
                          isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                        )}
                      >
                        <Clock className="size-3 shrink-0" />
                        <span>
                          {new Date(task.dueDate).toLocaleDateString('vi-VN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-11">—</span>
                    )}
                  </td>

                  {/* Actions Dropdown */}
                  <td
                    className="px-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity cursor-pointer"
                        >
                          <MoreHorizontal className="size-3.5 text-foreground shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-xs p-1">
                        <DropdownMenuItem onClick={() => onEditCard(task)} className="cursor-pointer">
                          View details
                        </DropdownMenuItem>
                        {!isReadOnly && (
                          <DropdownMenuItem onClick={() => onDuplicateCard(task)} className="cursor-pointer">
                            <Copy className="mr-2 size-3.5 shrink-0" />
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {currentUserId && (
                          <DropdownMenuItem
                            onClick={() => (isCurrentUser ? onLeaveCard(task) : onJoinCard(task))}
                            className="cursor-pointer"
                          >
                            {isCurrentUser ? (
                              <UserMinus className="mr-2 size-3.5 shrink-0" />
                            ) : (
                              <UserPlus className="mr-2 size-3.5 shrink-0" />
                            )}
                            {isCurrentUser ? 'Leave task' : 'Join task'}
                          </DropdownMenuItem>
                        )}
                        {onRemoveFromCycle && (
                          <DropdownMenuItem onClick={() => onRemoveFromCycle(task)} className="cursor-pointer">
                            <RotateCcw className="mr-2 size-3.5 shrink-0" />
                            Remove from cycle
                          </DropdownMenuItem>
                        )}
                        {!isReadOnly && (
                          <DropdownMenuItem
                            onClick={() => onDeleteCard(task)}
                            className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                          >
                            <Trash2 className="mr-2 size-3.5 shrink-0" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}

            {/* Quick Add Row */}
            {!isReadOnly && isAddingNew && (
              <tr className="bg-muted">
                <td className="px-3 text-center">
                  <Plus className="size-3.5 text-foreground mx-auto shrink-0" />
                </td>
                <td className="px-2.5 font-mono text-11 text-muted-foreground">NEW</td>
                <td className="px-2.5">
                  <span className="text-11 font-medium text-muted-foreground">Task</span>
                </td>
                <td colSpan={6} className="px-2.5 py-1.5">
                  <form onSubmit={handleQuickAddSubmit} className="flex items-center gap-2">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Type a task title and press Enter..."
                      autoFocus
                      className="flex-1 h-7 text-xs bg-background border border-border rounded-md px-2.5 text-foreground outline-none focus:border-primary"
                    />
                    <Select value={newColumnId} onValueChange={setNewColumnId}>
                      <SelectTrigger className="h-7 text-xs w-32 border-border bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        {columns.map((c) => {
                          const id = resolveTaskColumnId(c);
                          return (
                            <SelectItem key={id} value={id}>
                              {c.title}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" className="h-7 text-xs px-3">
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewTitle('');
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>

        {/* Empty State */}
        {sortedTasks.length === 0 && !isAddingNew && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <CheckSquare className="size-6 shrink-0" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">No tasks found</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get started by creating your first task.
              </p>
            </div>
            {!isReadOnly && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => setIsAddingNew(true)}
              >
                <Plus className="mr-1.5 size-3.5 shrink-0" />
                Add New Task
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer / Status Bar */}
      <div className="h-9 px-4 border-t border-border bg-muted flex items-center justify-between text-11 text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          <span>{sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}</span>
          {selectedTaskIds.length > 0 && (
            <span className="font-semibold text-foreground">
              • {selectedTaskIds.length} selected
            </span>
          )}
        </div>

        {!isReadOnly && !isAddingNew && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            className="h-6.5 text-11 font-medium text-foreground hover:bg-muted gap-1 px-2 cursor-pointer"
          >
            <Plus className="size-3 shrink-0" />
            <span>New Task</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default TableView;
