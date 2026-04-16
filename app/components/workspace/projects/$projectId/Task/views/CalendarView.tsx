import {
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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


type CalendarViewProps = {
  tasks: Task[];
  columns: Column[];
  workspaceId: string;
  projectId: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onOpenCardDetail: (task: Task) => void;
  onAssignExistingTasks: (taskIds: string[], dueDate: string) => void;
  isAddingCard?: boolean;
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
  isAddingCard,
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

  const columnMetaById = useMemo(() => {
    const meta = new Map<string, { color: string; title: string }>();

    columns.forEach((column) => {
      const columnId = resolveTaskColumnId(column);
      if (!columnId) return;
      meta.set(columnId, {
        color: resolveTaskColumnColor(columnId, column.accentColor),
        title: column.title || columnId,
      });
    });

    return meta;
  }, [columns]);

  const handlePrevious = () => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => subDays(current, 7));
      return;
    }

    setCurrentMonth((current) => subMonths(current, 1));
  };

  const handleNext = () => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => addDays(current, 7));
      return;
    }

    setCurrentMonth((current) => addMonths(current, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const title =
    layoutMode === "week"
      ? `${format(calendarDays[0], "d MMM")} - ${format(calendarDays[calendarDays.length - 1], "d MMM yyyy")}`
      : format(currentMonth, "MMMM yyyy");

  const dayCellMinHeight = layoutMode === "week" ? 750 : 150;
  // Đã loại bỏ defaultColumnId vì không còn cột mặc định

  const handleOpenQuickAdd = (dateKey: string) => {
    setQuickAddDateKey(dateKey);
    setQuickAddTitle("");
  };

  const handleCloseQuickAdd = () => {
    setQuickAddDateKey(null);
    setQuickAddTitle("");
  };

  const handleQuickAddSubmit = () => {
    if (!quickAddDateKey || columns.length === 0) return;

    const trimmedTitle = quickAddTitle.trim();
    if (!trimmedTitle) return;

    const dateKeyToSubmit = quickAddDateKey;
    // Luôn lấy cột đầu tiên nếu cần, không còn khái niệm default
    const columnIdToSubmit = columns.length > 0 ? resolveTaskColumnId(columns[0]) : "";
    setQuickAddDateKey(null);
    setQuickAddTitle("");

    onAddCard(columnIdToSubmit, trimmedTitle, createCalendarDueDate(dateKeyToSubmit));
  };

  const handleOpenAddTaskMenu = (dateKey: string) => {
    setAddTaskMenuDateKey(dateKey);
  };

  const handleAddWorkItem = (dateKey: string) => {
    setAddTaskMenuDateKey(null);
    setExistingDialogDateKey(null);
    handleOpenQuickAdd(dateKey);
  };

  const handleAddExistingWorkItem = (dateKey: string) => {
    setAddTaskMenuDateKey(null);
    setExistingDialogDateKey(dateKey);
    setExistingSearch("");
    setSelectedExistingTaskIds([]);
  };

  const handleCloseExistingDialog = () => {
    setExistingDialogDateKey(null);
    setExistingSearch("");
    setSelectedExistingTaskIds([]);
  };

  const handleToggleExistingTask = (taskId: string) => {
    setSelectedExistingTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleSubmitExistingTasks = () => {
    if (!existingDialogDateKey || selectedExistingTaskIds.length === 0) return;

    onAssignExistingTasks(
      selectedExistingTaskIds,
      createCalendarDueDate(existingDialogDateKey),
    );
    handleCloseExistingDialog();
  };

  return (
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
              <div
                key={dateKey}
                style={{ minHeight: dayCellMinHeight }}
                className={`group flex flex-col p-2.5 transition-colors ${
                  !isCurrentMonth
                    ? "bg-zinc-100"
                    : "bg-white"
                }`}
              >
                <div className="mb-2 flex items-start justify-end gap-1">
                  <span
                    className={
                      isThisToday
                        ? "inline-flex size-6 items-center justify-center rounded-full bg-black text-[11px] font-semibold leading-none tracking-tight text-white"
                        : `text-[11px] font-medium leading-none tracking-tight ${dayTextClass}`
                    }
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div
                  className={`space-y-2 overflow-y-auto ${
                    layoutMode === "week" ? "max-h-105" : "max-h-42.5"
                  }`}
                >
                  {dayTasks.map((task) => (
                    <CalendarTaskItem
                      key={task._id}
                      task={task}
                      onOpenCardDetail={onOpenCardDetail}
                    />
                  ))}
                </div>

                {!isQuickAdding && (
                  <DropdownMenu
                    open={addTaskMenuDateKey === dateKey}
                    onOpenChange={(open) => {
                      if (!open && addTaskMenuDateKey === dateKey) {
                        setAddTaskMenuDateKey(null);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleOpenAddTaskMenu(dateKey)}
                        className={`${dayTasks.length > 0 ? "mt-1.5" : "mt-0"} flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-[11.5px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 active:bg-zinc-200/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`}
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
                        onSelect={() => handleAddWorkItem(dateKey)}
                        className="rounded-sm px-3 py-2 text-[13px] font-normal text-zinc-700"
                      >
                        Add task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleAddExistingWorkItem(dateKey)}
                        className="rounded-sm px-3 py-2 text-[13px] font-normal text-zinc-700"
                      >
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
                        placeholder="Task title..."
                        className="h-6.5 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
                        disabled={isAddingCard}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6.5 bg-black px-2 text-white hover:bg-black/90 shadow-none"
                        onClick={handleQuickAddSubmit}
                        disabled={!quickAddTitle.trim() || columns.length === 0 || isAddingCard}
                      >
                        {isAddingCard ? "..." : "Add"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6.5 px-2 text-[#44546f] hover:bg-[#091e420f]"
                        onClick={handleCloseQuickAdd}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
                className="h-10 w-full pl-13 pr-3 text-[18px] font-medium text-zinc-900 outline-none transition-colors placeholder:font-normal placeholder:text-zinc-500 focus:border-zinc-300"
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
                        className="size-4 shrink-0 rounded-[2px] border-zinc-300 bg-white data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white"
                      />
                      <div className="flex flex-1 items-center gap-2.5 min-w-0">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700 group-hover:text-zinc-900">
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
                className="h-9 min-w-17.5 bg-black px-4 text-white shadow-none hover:bg-black/90 disabled:opacity-30"
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function CalendarTaskItem({
  task,
  onOpenCardDetail,
}: {
  task: Task;
  onOpenCardDetail: (task: Task) => void;
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnColor = resolveTaskColumnColor(task.columnId);
  const parsedDueDate = task.dueDate ? new Date(task.dueDate) : null;
  const hasValidDueDate =
    parsedDueDate !== null && !Number.isNaN(parsedDueDate.getTime());
  const todayDateKey = format(new Date(), DATE_KEY_FORMAT);
  const dueDateKey = getCalendarDateKey(task.dueDate);
  const isCompleted = Boolean(task.completed);
  const isOverdue = hasValidDueDate
    ? !isCompleted && dueDateKey !== todayDateKey && isPast(parsedDueDate)
    : false;

  useEffect(() => {
    return () => {
      if (!hoverTimerRef.current) return;
      clearTimeout(hoverTimerRef.current);
    };
  }, []);

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
    <Popover open={isPreviewOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => onOpenCardDetail(task)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="group relative flex w-full items-center gap-2 rounded-sm border border-zinc-200 bg-white px-3 py-1.5 text-left text-[12px] font-semibold leading-tight text-zinc-900 transition-colors hover:bg-zinc-50"
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
          <CardUI card={task} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
