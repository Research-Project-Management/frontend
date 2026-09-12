'use client';

import {
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  X,
  FolderKanban,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameWeek,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
  subMonths,
  subDays,
} from 'date-fns';
import {
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Dialog,
  DialogContent,
  Checkbox,
} from "@/shared/components/ui";
import type { Column, Task } from '../../types/types';
import { resolveStateId, resolveStateColor, PRIORITY_CONFIG } from '../../types/types';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/shared/lib/utils";
import { createPortal } from 'react-dom';

interface CalendarCardProps {
  card: Task;
  onRemoveFromCycle?: (card: Task) => void;
  isReadOnly?: boolean;
}

function CalendarCard({ card }: CalendarCardProps) {
  const priorityConfig = PRIORITY_CONFIG[card.priority || 'none'];
  const columnColor = resolveStateColor(card.columnId);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs w-72">
      <div className="flex items-center justify-between gap-2">
        {card.identifier && (
          <span className="text-10 font-mono text-muted-foreground font-semibold">
            {card.identifier}
          </span>
        )}
        {priorityConfig && (
          <span className="text-10 font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {priorityConfig.label}
          </span>
        )}
      </div>

      <div className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
        {card.title}
      </div>

      <div className="flex items-center justify-between pt-1 text-11 text-muted-foreground border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: columnColor }} />
          <span className="capitalize">{card.columnId}</span>
        </div>

        {card.assignee && (
          <div className="flex items-center gap-1">
            <Avatar className="size-4">
              <AvatarImage src={(card.assignee as any).avatar} />
              <AvatarFallback className="text-9">
                {(card.assignee as any).name ? (card.assignee as any).name.charAt(0) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span>{(card.assignee as any).name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type CalendarViewProps = {
  tasks: Task[];
  columns: Column[];
  workspaceId: string;
  projectId: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onOpenCardDetail: (task: Task) => void;
  onAssignExistingTasks: (taskIds: string[], dueDate: string, quiet?: boolean, startDate?: string | null) => void;
  onRemoveFromCycle?: (task: Task) => void;
  isAddingCard?: boolean;
  isReadOnly?: boolean;
};

type CalendarLayoutMode = "month" | "week";

const DATE_KEY_FORMAT = "yyyy-MM-dd";
const WEEK_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isMidnightDueDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.000)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
    value,
  );
}

function getCalendarDateKey(dueDate?: string | null) {
  if (!dueDate) return null;
  if (DATE_KEY_PATTERN.test(dueDate)) return dueDate;

  const [datePart] = dueDate.split("T");
  const parsedDate = new Date(dueDate);

  if (isMidnightDueDate(dueDate) && DATE_KEY_PATTERN.test(datePart)) {
    return datePart;
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return DATE_KEY_PATTERN.test(datePart) ? datePart : null;
  }

  return format(parsedDate, DATE_KEY_FORMAT);
}

function createCalendarDueDate(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

export function CalendarView({
  tasks,
  columns,
  workspaceId,
  projectId,
  onAddCard,
  onOpenCardDetail,
  onAssignExistingTasks,
  onRemoveFromCycle,
  isAddingCard,
  isReadOnly,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [layoutMode, setLayoutMode] = useState<CalendarLayoutMode>("month");
  const [quickAddDateKey, setQuickAddDateKey] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [addTaskMenuDateKey, setAddTaskMenuDateKey] = useState<string | null>(null);
  const [existingDialogDateKey, setExistingDialogDateKey] = useState<string | null>(
    null,
  );
  const [existingSearch, setExistingSearch] = useState("");
  const [selectedExistingTaskIds, setSelectedExistingTaskIds] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggedWidth, setDraggedWidth] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const calendarDays = useMemo(() => {
    if (layoutMode === "week") {
      const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }

    const monthStart = startOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth, layoutMode]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    tasks.forEach((task) => {
      const dateKey = getCalendarDateKey(task.dueDate);
      if (!dateKey) return;
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(task);
    });

    return grouped;
  }, [tasks]);

  const existingTaskCandidates = useMemo(
    () => tasks.filter((task) => !task.dueDate),
    [tasks],
  );

  const filteredExistingTaskCandidates = useMemo(() => {
    const keyword = existingSearch.trim().toLowerCase();
    if (!keyword) return existingTaskCandidates;

    return existingTaskCandidates.filter((task) => {
      const identifierText = task.identifier?.toLowerCase() || "";
      const titleText = task.title?.toLowerCase() || "";
      return identifierText.includes(keyword) || titleText.includes(keyword);
    });
  }, [existingSearch, existingTaskCandidates]);

  const allFilteredTasksSelected = useMemo(() => {
    if (filteredExistingTaskCandidates.length === 0) return false;

    const selectedSet = new Set(selectedExistingTaskIds);
    return filteredExistingTaskCandidates.every((task) =>
      selectedSet.has(task.id),
    );
  }, [filteredExistingTaskCandidates, selectedExistingTaskIds]);

  const handlePrevious = useCallback(() => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => subDays(current, 7));
      return;
    }
    setCurrentMonth((current) => subMonths(current, 1));
  }, [layoutMode]);

  const handleNext = useCallback(() => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => addDays(current, 7));
      return;
    }
    setCurrentMonth((current) => addMonths(current, 1));
  }, [layoutMode]);

  const handleToday = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  const title =
    layoutMode === "week"
      ? `${format(calendarDays[0], "d MMM")} - ${format(calendarDays[calendarDays.length - 1], "d MMM yyyy")}`
      : format(currentMonth, "MMMM yyyy");

  const dayCellMinHeight = layoutMode === "week" ? 750 : 150;

  const handleOpenQuickAdd = useCallback((dateKey: string) => {
    setQuickAddDateKey(dateKey);
    setQuickAddTitle("");
  }, []);

  const handleCloseQuickAdd = useCallback(() => {
    setQuickAddDateKey(null);
    setQuickAddTitle("");
  }, []);

  const handleQuickAddSubmit = useCallback(() => {
    if (!quickAddDateKey || columns.length === 0) return;

    const trimmedTitle = quickAddTitle.trim();
    if (!trimmedTitle) return;

    const dateKeyToSubmit = quickAddDateKey;
    const columnIdToSubmit = columns.length > 0 ? resolveStateId(columns[0]) : "";
    setQuickAddDateKey(null);
    setQuickAddTitle("");

    onAddCard(columnIdToSubmit, trimmedTitle, createCalendarDueDate(dateKeyToSubmit));
  }, [quickAddDateKey, columns, quickAddTitle, onAddCard]);

  const handleOpenAddTaskMenu = useCallback((dateKey: string) => {
    setAddTaskMenuDateKey(dateKey);
  }, []);

  const handleAddTask = useCallback((dateKey: string) => {
    setAddTaskMenuDateKey(null);
    setExistingDialogDateKey(null);
    handleOpenQuickAdd(dateKey);
  }, [handleOpenQuickAdd]);

  const handleAddExistingTask = useCallback((dateKey: string) => {
    setAddTaskMenuDateKey(null);
    setExistingDialogDateKey(dateKey);
    setExistingSearch("");
    setSelectedExistingTaskIds([]);
  }, []);

  const handleCloseExistingDialog = useCallback(() => {
    setExistingDialogDateKey(null);
    setExistingSearch("");
    setSelectedExistingTaskIds([]);
  }, []);

  const handleToggleExistingTask = useCallback((taskId: string) => {
    setSelectedExistingTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  }, []);

  const handleSubmitExistingTasks = useCallback(() => {
    if (!existingDialogDateKey || selectedExistingTaskIds.length === 0) return;

    onAssignExistingTasks(
      selectedExistingTaskIds,
      createCalendarDueDate(existingDialogDateKey),
    );
    handleCloseExistingDialog();
  }, [existingDialogDateKey, selectedExistingTaskIds, onAssignExistingTasks, handleCloseExistingDialog]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task;
    if (task) {
      setActiveTask(task);
      setDraggedWidth(event.active.rect.current.initial?.width ?? null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    setDraggedWidth(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const dateKey = String(over.id);

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentDueDateKey = getCalendarDateKey(task.dueDate);
    const isMovingForward = currentDueDateKey && dateKey > currentDueDateKey;

    if (isMovingForward) {
      // Design: if moving forward, preserve start date
      onAssignExistingTasks(
        [taskId],
        createCalendarDueDate(dateKey),
        true,
        task.startDate,
      );
    } else {
      // Design: if moving backward, only keep the end date (clear start date)
      onAssignExistingTasks([taskId], createCalendarDueDate(dateKey), true, null);
    }
  }, [onAssignExistingTasks, tasks]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden bg-background">
        {/* Full-Bleed Calendar Header Toolbar (No bottom border dividing from content) */}
        <div className="h-11 px-4 flex items-center justify-between bg-background shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              aria-label="Previous period"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer"
            >
              <ChevronLeft className="size-4 shrink-0" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              aria-label="Next period"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer"
            >
              <ChevronRight className="size-4 shrink-0" />
            </Button>
            <div className="flex items-center gap-2 pl-1">
              <h3 className="text-14 font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-7 px-2.5 text-11 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer"
            >
              Today
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Calendar options"
                  className="h-7 gap-1.5 border border-border px-2.5 text-11 font-medium text-foreground rounded-md cursor-pointer"
                >
                  Options
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-48 rounded-lg p-1 text-xs"
              >
                <DropdownMenuItem
                  onSelect={() => setLayoutMode("month")}
                  className="pl-3 pr-2 py-2 flex items-center cursor-pointer text-xs"
                >
                  <span className="flex-1 text-left text-foreground">Month layout</span>
                  {layoutMode === "month" ? <Check className="h-4 w-4 ml-2 text-primary shrink-0" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setLayoutMode("week")}
                  className="pl-3 pr-2 py-2 flex items-center cursor-pointer text-xs"
                >
                  <span className="flex-1 text-left text-foreground">Week layout</span>
                  {layoutMode === "week" ? <Check className="h-4 w-4 ml-2 text-primary shrink-0" /> : null}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable Calendar Grid (Unified 7-Column Grid with sleek custom scrollbar) */}
        <div className="flex-1 overflow-auto vertical-scrollbar custom-scrollbar">
          <div className="grid grid-cols-7 bg-background min-h-full min-w-[560px]">
            {/* Week Day Labels (Row 1 of Grid - Centralized bg-secondary, Natural Title Case, No Bottom Border) */}
            {WEEK_DAY_LABELS.map((label) => (
              <div
                key={label}
                className="sticky top-0 z-20 h-8 px-3 flex items-center justify-end text-11 font-medium text-muted-foreground bg-secondary [&:not(:nth-child(7n))]:border-r border-border select-none"
              >
                {label}
              </div>
            ))}

            {/* Calendar Days (Rows 2+ of Grid) */}
            {calendarDays.map((day) => {
              const dateKey = format(day, DATE_KEY_FORMAT);
              const dayTasks = tasksByDate.get(dateKey) || [];
              const isQuickAdding = quickAddDateKey === dateKey;
              const isCurrentMonth =
                layoutMode === "week"
                  ? isSameWeek(day, currentMonth, { weekStartsOn: 1 })
                  : isSameMonth(day, currentMonth);
              const isThisToday = isToday(day);
              const isWeekendDay = isWeekend(day);
              const dayTextClass = !isCurrentMonth
                ? "text-muted-foreground"
                : isWeekendDay
                    ? "text-muted-foreground"
                    : "text-foreground";

              return (
                <CalendarDayCell
                  key={dateKey}
                  dateKey={dateKey}
                  day={day}
                  dayTasks={dayTasks}
                  isQuickAdding={isQuickAdding}
                  isCurrentMonth={isCurrentMonth}
                  isThisToday={isThisToday}
                  dayTextClass={dayTextClass}
                  dayCellMinHeight={dayCellMinHeight}
                  layoutMode={layoutMode}
                  onOpenCardDetail={onOpenCardDetail}
                  handleOpenAddTaskMenu={handleOpenAddTaskMenu}
                  addTaskMenuDateKey={addTaskMenuDateKey}
                  isAddTaskMenuOpen={addTaskMenuDateKey === dateKey}
                  onSetAddTaskMenuDateKey={setAddTaskMenuDateKey}
                  onAddWorkItem={handleAddTask}
                  onAddExistingWorkItem={handleAddExistingTask}
                  quickAddTitle={quickAddTitle}
                  onSetQuickAddTitle={setQuickAddTitle}
                  onQuickAddSubmit={handleQuickAddSubmit}
                  onCloseQuickAdd={handleCloseQuickAdd}
                  onRemoveFromCycle={onRemoveFromCycle}
                  isAddingCard={isAddingCard}
                  columns={columns}
                  isReadOnly={isReadOnly}
                />
              );
            })}
          </div>
        </div>

        <Dialog
          open={Boolean(existingDialogDateKey)}
          onOpenChange={(open) => {
            if (!open) handleCloseExistingDialog();
          }}
        >
          <DialogContent className="w-145 max-w-[90vw] overflow-hidden rounded-lg border border-border p-0" showCloseButton={false}>
            {/* Search bar */}
            <div className="px-2 pt-6 pb-2">
              <div className="relative flex items-center">
                <Search className="absolute left-4 size-5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                <input
                  type="text"
                  value={existingSearch}
                  onChange={(event) => setExistingSearch(event.target.value)}
                  placeholder="Type to search"
                  autoFocus
                  className="h-10 w-full pl-13 pr-3 text-lg font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus:border-border"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selectedExistingTaskIds.length > 0 && (
              <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 px-5 py-2">
                {selectedExistingTaskIds.map((taskId) => {
                  const selectedTask = existingTaskCandidates.find(
                    (task) => task.id === taskId,
                  );
                  if (!selectedTask) return null;
                  return (
                    <button
                      key={taskId}
                      type="button"
                      onClick={() => handleToggleExistingTask(taskId)}
                      className="group inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                      title={selectedTask.title || "Untitled task"}
                    >
                      <span className="max-w-45 truncate">
                        {selectedTask.title || "Untitled task"}
                      </span>
                      <X className="size-3 text-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Task list */}
            <div className="max-h-80 overflow-y-auto px-1 py-2">
              {filteredExistingTaskCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Search className="size-8 mb-2 opacity-20 shrink-0" strokeWidth={1.5} />
                  <p className="text-sm font-medium">No work items found</p>
                </div>
              ) : (
                filteredExistingTaskCandidates.map((task) => {
                  const checked = selectedExistingTaskIds.includes(task.id);

                  return (
                    <div key={task.id} className="px-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExistingTask(task.id)}
                        className="group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          aria-label={`Select task ${task.title}`}
                          className="size-4 shrink-0 rounded-sm border-border bg-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <div className="flex flex-1 items-center gap-2.5 min-w-0">
                          {(() => {
                            const col = columns.find(c => c.id === task.columnId);
                            if (!col) return null;
                            return (
                              <span className="shrink-0 text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm truncate max-w-[80px]">
                                {col.title}
                              </span>
                            );
                          })()}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                            {task.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenCardDetail(task);
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
                          aria-label="Open task detail"
                        >
                          <ChevronRight className="size-3.5 shrink-0" />
                        </button>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
              <div className="mt-1 flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  if (allFilteredTasksSelected) {
                    const visibleIds = new Set(
                      filteredExistingTaskCandidates.map((task) => task.id),
                    );
                    setSelectedExistingTaskIds((prev) =>
                      prev.filter((id) => !visibleIds.has(id)),
                    );
                  } else {
                    const visibleIds = filteredExistingTaskCandidates.map(
                      (task) => task.id,
                    );
                    setSelectedExistingTaskIds((prev) =>
                      Array.from(new Set([...prev, ...visibleIds])),
                    );
                  }
                }}
                disabled={filteredExistingTaskCandidates.length === 0}
                className="h-8 rounded-sm px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                {allFilteredTasksSelected ? "Deselect all" : "Select all"}
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseExistingDialog}
                  className="h-9 px-3 text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitExistingTasks}
                  disabled={selectedExistingTaskIds.length === 0}
                  className="h-9 min-w-17.5 bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary-hover disabled:opacity-30"
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isMounted && createPortal(
        <DragOverlay>
          {activeTask ? (
            <div 
              style={{ width: draggedWidth ?? 'auto' }} 
              className="bg-card border border-border rounded-lg overflow-hidden opacity-90"
            >
              <div className="relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium leading-tight text-foreground">
                <span
                  className="absolute left-0 top-1/2 h-5.5 w-0.5 -translate-y-1/2 rounded-r-full"
                  style={{ backgroundColor: resolveStateColor(activeTask.columnId) }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {activeTask.title}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

const CalendarDayCell = memo(({
  dateKey,
  day,
  dayTasks,
  isQuickAdding,
  isCurrentMonth,
  isThisToday,
  dayTextClass,
  dayCellMinHeight,
  layoutMode,
  onOpenCardDetail,
  handleOpenAddTaskMenu,
  addTaskMenuDateKey,
  onSetAddTaskMenuDateKey,
  onAddWorkItem,
  onAddExistingWorkItem,
  onRemoveFromCycle,
  onSetQuickAddTitle,
  onQuickAddSubmit,
  onCloseQuickAdd,
  isAddingCard,
  columns,
  isReadOnly,
  quickAddTitle = '',
}: any) => {
  const isAddTaskMenuOpen = addTaskMenuDateKey === dateKey;
  const isWeekendDay = isWeekend(day);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ minHeight: dayCellMinHeight }}
      className={cn(
        "group flex flex-col transition-colors border-b [&:not(:nth-child(7n))]:border-r border-border",
        !isCurrentMonth
          ? "bg-muted text-muted-foreground"
          : isWeekendDay
          ? "bg-secondary"
          : "bg-background",
        isOver && "bg-muted ring-1 ring-inset ring-ring"
      )}
    >
      {/* Day number header row - perfectly positioned top right */}
      <div className="flex items-center justify-end px-3 pt-2 pb-1 text-right select-none">
        {day.getDate() === 1 && (
          <span className="text-11 font-medium text-muted-foreground mr-1">
            {format(day, "MMM")}
          </span>
        )}
        {isThisToday ? (
          <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-primary text-11 font-semibold text-primary-foreground shadow-xs">
            {format(day, "d")}
          </span>
        ) : (
          <span
            className={cn(
              "text-11 font-medium leading-none",
              !isCurrentMonth
                ? "text-muted-foreground"
                : isWeekendDay
                ? "text-muted-foreground"
                : "text-foreground"
            )}
          >
            {format(day, "d")}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col px-2 pb-2 min-h-0">
        <div
          className={cn(
            "space-y-1.5 overflow-y-auto custom-scrollbar flex-1 min-h-[1px]",
            layoutMode === "week" ? "max-h-175" : "max-h-48"
          )}
        >
          {dayTasks.map((task: any) => (
            <CalendarTaskItem
              key={task.id}
              task={task}
              onOpenCardDetail={onOpenCardDetail}
              onRemoveFromCycle={onRemoveFromCycle}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>

        {!isReadOnly && !isQuickAdding && (
          <DropdownMenu
            open={isAddTaskMenuOpen}
            onOpenChange={(open) => {
              if (!open && isAddTaskMenuOpen) {
                onSetAddTaskMenuDateKey(null);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={() => handleOpenAddTaskMenu(dateKey)}
                className={cn(
                  dayTasks.length > 0 ? "mt-1.5" : "mt-0",
                  "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-11 font-medium text-foreground transition-colors hover:bg-muted cursor-pointer",
                  "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
                )}
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span>Add task</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-44 rounded-md border border-border bg-popover p-1 text-xs"
            >
              <DropdownMenuItem
                onSelect={() => onAddWorkItem(dateKey)}
                className="rounded-sm px-2.5 py-1.5 text-11 font-medium text-foreground flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-muted"
              >
                <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                <span>Add task</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onAddExistingWorkItem(dateKey)}
                className="rounded-sm px-2.5 py-1.5 text-11 font-medium text-foreground flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-muted"
              >
                <FolderKanban className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                <span>Add existing task</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isQuickAdding && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="relative flex w-full items-center rounded-md border border-border bg-background focus-within:border-ring">
              <input
                type="text"
                autoFocus
                value={quickAddTitle}
                onChange={(event) => onSetQuickAddTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onQuickAddSubmit();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCloseQuickAdd();
                  }
                }}
                placeholder="Task title..."
                className="h-7 min-w-0 flex-1 bg-transparent px-2 text-12 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                disabled={isAddingCard}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-11 font-medium bg-primary hover:bg-primary-hover text-primary-foreground rounded-md cursor-pointer shadow-none"
                onClick={onQuickAddSubmit}
                disabled={!quickAddTitle.trim() || columns.length === 0 || isAddingCard}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-11 font-medium rounded-md hover:bg-muted cursor-pointer"
                onClick={onCloseQuickAdd}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const CalendarTaskItem = memo(({
  task,
  onOpenCardDetail,
  onRemoveFromCycle,
  isReadOnly,
}: {
  task: Task;
  onOpenCardDetail: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  isReadOnly?: boolean;
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnColor = resolveStateColor(task.columnId);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: isReadOnly,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsPreviewOpen(true);
    }, 450);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewOpen(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Popover open={isPreviewOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenCardDetail(task)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              "group relative flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-left text-12 font-medium leading-tight text-foreground transition-colors hover:bg-muted cursor-pointer",
              isDragging && "z-50 opacity-40 border-primary"
            )}
          >
            <span
              className="absolute left-0 top-1/2 h-5.5 w-0.5 -translate-y-1/2 rounded-r-full"
              style={{ backgroundColor: columnColor }}
            />
            <span className="min-w-0 flex-1 truncate transition-colors">
              {task.title}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-80 border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e: Event) => e.preventDefault()}
        >
          <div className="pointer-events-none">
            <CalendarCard card={task} onRemoveFromCycle={onRemoveFromCycle} isReadOnly={isReadOnly} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
export default CalendarView;
