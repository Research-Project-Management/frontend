import {
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  X,
  FolderKanban,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isPast,
  isSameMonth,
  isSameWeek,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
  subMonths,
  subDays,
} from "date-fns";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { CardUI } from "../Card";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";
import type { Column, Task } from "~/types/task";
import { resolveTaskColumnId, resolveTaskColumnColor } from "~/types/task";
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
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "~/lib/utils";
import { createPortal } from "react-dom";

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

export default function CalendarView({
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
      selectedSet.has(task._id),
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
    const columnIdToSubmit = columns.length > 0 ? resolveTaskColumnId(columns[0]) : "";
    setQuickAddDateKey(null);
    setQuickAddTitle("");

    onAddCard(columnIdToSubmit, trimmedTitle, createCalendarDueDate(dateKeyToSubmit));
  }, [quickAddDateKey, columns, quickAddTitle, onAddCard]);

  const handleOpenAddTaskMenu = useCallback((dateKey: string) => {
    setAddTaskMenuDateKey(dateKey);
  }, []);

  const handleAddWorkItem = useCallback((dateKey: string) => {
    setAddTaskMenuDateKey(null);
    setExistingDialogDateKey(null);
    handleOpenQuickAdd(dateKey);
  }, [handleOpenQuickAdd]);

  const handleAddExistingWorkItem = useCallback((dateKey: string) => {
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

    const task = tasks.find((t) => t._id === taskId);
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
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="h-8 w-8 rounded-sm text-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 rounded-sm text-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 pl-1">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-8 px-3 text-xs font-medium text-foreground hover:bg-muted/70 hover:text-foreground"
            >
              Today
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 bg-muted/70 px-3 text-xs font-medium text-foreground"
                >
                  Options
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-sm p-1">
                <DropdownMenuItem
                  onSelect={() => setLayoutMode("month")}
                  className="pl-4 pr-2 py-2 flex items-center"
                >
                  <span className="flex-1 text-left">Month layout</span>
                  {layoutMode === "month" ? <Check className="h-4 w-4 ml-2" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setLayoutMode("week")}
                  className="pl-4 pr-2 py-2 flex items-center"
                >
                  <span className="flex-1 text-left">Week layout</span>
                  {layoutMode === "week" ? <Check className="h-4 w-4 ml-2" /> : null}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-hidden border border-zinc-200 bg-zinc-100/80">
          <div className="grid grid-cols-7 divide-x divide-zinc-200 bg-zinc-100">
            {WEEK_DAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={`py-2.5 text-center text-[11px] font-semibold ${
                  index >= 5 ? "text-zinc-500" : "text-zinc-600"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/70 bg-zinc-100/80">
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
                ? "text-gray-400"
                : isWeekendDay
                    ? "text-gray-600"
                    : "text-slate-700";

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
                  onAddWorkItem={handleAddWorkItem}
                  onAddExistingWorkItem={handleAddExistingWorkItem}
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
          <DialogContent className="w-145 max-w-[90vw] overflow-hidden rounded-sm border border-zinc-200 p-0 shadow-2xl" showCloseButton={false}>
            {/* Search bar */}
            <div className="px-2 pt-6 pb-2">
              <div className="relative flex items-center">
                <Search className="absolute left-4 size-5 text-zinc-700" strokeWidth={2.25} />
                <input
                  type="text"
                  value={existingSearch}
                  onChange={(event) => setExistingSearch(event.target.value)}
                  placeholder="Type to search"
                  autoFocus
                  className="h-10 w-full pl-13 pr-3 text-[18px] font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-zinc-500 focus:border-zinc-300"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selectedExistingTaskIds.length > 0 && (
              <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 px-5 py-2">
                {selectedExistingTaskIds.map((taskId) => {
                  const selectedTask = existingTaskCandidates.find(
                    (task) => task._id === taskId,
                  );
                  if (!selectedTask) return null;
                  return (
                    <button
                      key={taskId}
                      type="button"
                      onClick={() => handleToggleExistingTask(taskId)}
                      className="group inline-flex items-center gap-1.5 rounded-sm border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-50"
                      title={selectedTask.title || "Untitled task"}
                    >
                      <span className="max-w-45 truncate">
                        {selectedTask.title || "Untitled task"}
                      </span>
                      <X className="size-3 text-zinc-400 group-hover:text-zinc-600" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Task list */}
            <div className="max-h-80 overflow-y-auto px-1 py-2">
              {filteredExistingTaskCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-300">
                  <Search className="size-8 mb-2 opacity-10" strokeWidth={1.5} />
                  <p className="text-[13px] font-medium">No tasks found</p>
                </div>
              ) : (
                filteredExistingTaskCandidates.map((task) => {
                  const checked = selectedExistingTaskIds.includes(task._id);

                  return (
                    <div key={task._id} className="px-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExistingTask(task._id)}
                        className="group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-[#091e420f]"
                      >
                        <Checkbox
                          checked={checked}
                          className="size-4 shrink-0 rounded-[2px] border-zinc-300 bg-white data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
                        />
                        <div className="flex flex-1 items-center gap-2.5 min-w-0">
                          {(() => {
                            const col = columns.find(c => c.id === task.columnId || c._id?.toString() === task.columnId);
                            if (!col) return null;
                            return (
                              <span className="shrink-0 text-[11px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-[2px] truncate max-w-[80px]">
                                {col.title}
                              </span>
                            );
                          })()}
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700 group-hover:text-foreground transition-colors">
                            {task.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenCardDetail(task);
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-zinc-300 transition-colors hover:bg-[#091e420f] hover:text-zinc-500"
                          aria-label="Open task detail"
                        >
                          <ChevronRight className="size-3.5" />
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
                      filteredExistingTaskCandidates.map((task) => task._id),
                    );
                    setSelectedExistingTaskIds((prev) =>
                      prev.filter((id) => !visibleIds.has(id)),
                    );
                  } else {
                    const visibleIds = filteredExistingTaskCandidates.map(
                      (task) => task._id,
                    );
                    setSelectedExistingTaskIds((prev) =>
                      Array.from(new Set([...prev, ...visibleIds])),
                    );
                  }
                }}
                disabled={filteredExistingTaskCandidates.length === 0}
                className="h-8 rounded-sm px-2 text-[12px] font-semibold text-[#44546f] transition-colors hover:bg-[#091e420f] disabled:opacity-30"
              >
                {allFilteredTasksSelected ? "Deselect all" : "Select all"}
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseExistingDialog}
                  className="h-9 px-3 text-[#44546f] hover:bg-[#091e420f]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitExistingTasks}
                  disabled={selectedExistingTaskIds.length === 0}
                  className="h-9 min-w-17.5 bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary/90 disabled:opacity-30"
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
              className="bg-white shadow-lg border border-zinc-200 rounded-sm overflow-hidden opacity-90"
            >
              <div className="relative flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold leading-tight text-foreground">
                <span
                  className="absolute left-0 top-1/2 h-5.5 w-0.5 -translate-y-1/2 rounded-r-full"
                  style={{ backgroundColor: resolveTaskColumnColor(activeTask.columnId) }}
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
  isAddTaskMenuOpen,
  onSetAddTaskMenuDateKey,
  onAddWorkItem,
  onAddExistingWorkItem,
  onRemoveFromCycle,
  quickAddTitle,
  onSetQuickAddTitle,
  onQuickAddSubmit,
  onCloseQuickAdd,
  isAddingCard,
  columns,
  isReadOnly,
}: any) => {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ minHeight: dayCellMinHeight }}
      className={cn(
        "group flex flex-col p-2.5 transition-colors",
        !isCurrentMonth ? "bg-zinc-100" : "bg-white",
        isOver && "bg-zinc-50 ring-1 ring-inset ring-zinc-300/50"
      )}
    >
      <div className="mb-2 flex items-start justify-end gap-1">
        <span
          className={
            isThisToday
              ? "inline-flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white pt-[1px]"
              : `text-[11px] font-medium leading-none tracking-tight ${dayTextClass}`
          }
        >
          {format(day, "d")}
        </span>
      </div>

      <div
        className={cn(
          "space-y-2 overflow-y-auto custom-scrollbar min-h-[1px]",
          layoutMode === "week" ? "max-h-105" : "max-h-42.5"
        )}
      >
        {dayTasks.map((task: any) => (
            <CalendarTaskItem
              key={task._id}
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
                "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[11.5px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-foreground active:bg-zinc-200/80",
                "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
              )}
            >
              <Plus className="size-3.5 shrink-0" />
              <span>Add task</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-44 rounded-sm border border-zinc-200 bg-white p-1 shadow-lg"
          >
            <DropdownMenuItem
              onSelect={() => onAddWorkItem(dateKey)}
              className="rounded-sm px-3 py-2 text-[13px] font-medium text-zinc-700 flex items-center gap-2.5 cursor-pointer outline-none hover:bg-zinc-50"
            >
              <Plus className="size-3.5 text-zinc-400" />
              Add task
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onAddExistingWorkItem(dateKey)}
              className="rounded-sm px-3 py-2 text-[13px] font-medium text-zinc-700 flex items-center gap-2.5 cursor-pointer outline-none hover:bg-zinc-50"
            >
              <FolderKanban className="size-3.5 text-zinc-400" />
              Add existing task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isQuickAdding && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="relative flex w-full items-center rounded-sm border border-zinc-200 bg-zinc-50/50 focus-within:border-zinc-300">
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
              className="h-6.5 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
              disabled={isAddingCard}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-6.5 bg-primary px-2 text-primary-foreground hover:bg-primary/90 shadow-none"
              onClick={onQuickAddSubmit}
              disabled={!quickAddTitle.trim() || columns.length === 0 || isAddingCard}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6.5 px-2 text-[#44546f] hover:bg-[#091e420f]"
              onClick={onCloseQuickAdd}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
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
  const columnColor = resolveTaskColumnColor(task.columnId);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
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
              "group relative flex w-full items-center gap-2 rounded-sm border border-zinc-200 bg-white px-3 py-1.5 text-left text-[12px] font-semibold leading-tight text-foreground transition-colors hover:bg-zinc-50",
              isDragging && "shadow-xl z-50"
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
            <CardUI card={task} onRemoveFromCycle={onRemoveFromCycle} isReadOnly={isReadOnly} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
