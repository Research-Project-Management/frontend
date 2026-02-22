import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isPast,
  isToday,
  isWeekend,
} from "date-fns";
import { Button } from "~/components/ui/button";
import type { Task } from "~/types/task";

interface CalendarViewProps {
  tasks: Task[];
  workspaceId: string;
}

export default function CalendarView({
  tasks,
  workspaceId,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), "yyyy-MM-dd");
        if (!grouped.has(dateKey)) grouped.set(dateKey, []);
        grouped.get(dateKey)!.push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const totalTasksThisMonth = useMemo(() => {
    return calendarDays.reduce((acc, day) => {
      if (!isSameMonth(day, currentMonth)) return acc;
      const key = format(day, "yyyy-MM-dd");
      return acc + (tasksByDate.get(key)?.length || 0);
    }, 0);
  }, [calendarDays, currentMonth, tasksByDate]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold text-gray-900">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
          </div>
          {totalTasksThisMonth > 0 && (
            <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-semibold">
              {totalTasksThisMonth} task{totalTasksThisMonth !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs font-medium border-gray-200 hover:border-primary hover:text-primary"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-8 w-8 border-gray-200 hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8 border-gray-200 hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {[
            { short: "Sun", isWeekend: true },
            { short: "Mon", isWeekend: false },
            { short: "Tue", isWeekend: false },
            { short: "Wed", isWeekend: false },
            { short: "Thu", isWeekend: false },
            { short: "Fri", isWeekend: false },
            { short: "Sat", isWeekend: true },
          ].map((day) => (
            <div
              key={day.short}
              className={`py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                day.isWeekend ? "text-red-400" : "text-gray-500"
              }`}
            >
              {day.short}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isThisToday = isToday(day);
            const isWeekendDay = isWeekend(day);
            const overdueCount = dayTasks.filter(
              (t) =>
                t.dueDate &&
                isPast(new Date(t.dueDate)) &&
                !isToday(new Date(t.dueDate)) &&
                t.columnId !== "done",
            ).length;

            return (
              <div
                key={idx}
                className={`min-h-32.5 p-2.5 flex flex-col transition-colors ${
                  !isCurrentMonth
                    ? "bg-gray-50/70"
                    : isThisToday
                      ? "bg-primary/5"
                      : isWeekendDay
                        ? "bg-slate-50/60"
                        : "bg-white hover:bg-gray-50/80"
                }`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full ${
                      !isCurrentMonth
                        ? "text-gray-300"
                        : isThisToday
                          ? "bg-primary text-white shadow-sm"
                          : isWeekendDay
                            ? "text-red-400"
                            : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex items-center gap-1">
                    {overdueCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">
                        {overdueCount} late
                      </span>
                    )}
                    {dayTasks.length > 0 && overdueCount === 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="space-y-1 flex-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <CalendarTaskItem
                      key={task._id}
                      task={task}
                      workspaceId={workspaceId}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center py-0.5 font-medium hover:text-primary cursor-default">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/30" />
          <span className="text-xs text-gray-500">In progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" />
          <span className="text-xs text-gray-500">Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />
          <span className="text-xs text-gray-500">Completed</span>
        </div>
      </div>
    </div>
  );
}

function CalendarTaskItem({
  task,
  workspaceId,
}: {
  task: Task;
  workspaceId: string;
}) {
  const isOverdue =
    task.dueDate &&
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate)) &&
    task.columnId !== "done";
  const isCompleted = task.columnId === "done";
  const projectData = task.project as any;

  return (
    <Link
      to={`/${workspaceId}/projects/${projectData?._id || task.project}/tasks`}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium truncate transition-all group ${
        isCompleted
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
          : isOverdue
            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            : "bg-primary/8 text-primary hover:bg-primary/15 border border-primary/20"
      }`}
      title={task.title}
    >
      <span className="shrink-0 text-[11px] leading-none">
        {projectData?.emoji || "📋"}
      </span>
      <span className="truncate group-hover:underline underline-offset-1">
        {task.title}
      </span>
    </Link>
  );
}
