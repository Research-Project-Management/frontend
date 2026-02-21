import { ChevronLeft, ChevronRight } from "lucide-react";
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

  // Get all days to display in the calendar
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), "yyyy-MM-dd");
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(task);
      }
    });

    return grouped;
  }, [tasks]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h3>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-8 text-xs hover:text-primary"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-8 w-8 hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8 hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-gray-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isThisToday = isToday(day);

            return (
              <div
                key={idx}
                className={`min-h-[100px] p-2 border-r border-b border-gray-200 transition-colors ${
                  !isCurrentMonth ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                } ${idx % 7 === 0 || idx % 7 === 6 ? "bg-gray-50/50" : ""}`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      !isCurrentMonth
                        ? "text-gray-400"
                        : isThisToday
                          ? "bg-primary text-white rounded-full h-5 w-5 flex items-center justify-center"
                          : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <CalendarTaskItem
                      key={task._id}
                      task={task}
                      workspaceId={workspaceId}
                    />
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[10px] text-gray-500 text-center py-0.5">
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
  const projectData = task.project as any;

  return (
    <Link
      to={`/${workspaceId}/projects/${projectData?._id || task.project}/tasks`}
      className={`block px-1.5 py-1 rounded text-[10px] font-medium truncate transition-all group ${
        isOverdue
          ? "bg-red-50 text-red-700 hover:bg-red-100"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
      title={task.title}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px]">{projectData?.emoji || "📋"}</span>
        <span className="truncate group-hover:underline underline-offset-2">
          {task.title}
        </span>
      </div>
    </Link>
  );
}
