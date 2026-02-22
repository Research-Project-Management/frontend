import {
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  UserStar,
  Loader2,
  List,
  AlertCircle,
  LayoutList,
  CalendarDays,
  FolderOpen,
  User2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { useWorkspaceTasks } from "~/query/task";
import type { Task } from "~/types/task";
import { format, isPast, isToday } from "date-fns";
import CalendarView from "./CalendarView";
import HomeSection from "../Home/HomeSection";

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { data: tasks = [], isLoading } = useWorkspaceTasks(workspaceId || "");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(
      (t) =>
        t.dueDate &&
        isPast(new Date(t.dueDate)) &&
        !isToday(new Date(t.dueDate)) &&
        t.columnId !== "done",
    ).length;
    const completed = tasks.filter((t) => t.columnId === "done").length;
    const inProgress = tasks.filter(
      (t) => t.columnId && t.columnId !== "done",
    ).length;

    return { total, inProgress, completed, overdue };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <UserStar className="h-4 w-4 text-primary" />
            <h1 className="font-semibold text-primary">Your Works</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with compact stats */}
      <header className="flex items-center justify-between px-4 py-3 border-b gap-4">
        <div
          className="flex items-center gap-2 shrink-0"
          style={{ paddingLeft: "var(--header-offset, 0px)" }}
        >
          <UserStar className="h-4 w-4 text-primary" />
          <h1 className="font-semibold text-primary">Your Works</h1>
        </div>

        {/* Compact stats chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <CompactStat
            icon={<LayoutList className="h-3 w-3" />}
            label="Total"
            value={stats.total}
            className="text-blue-600 bg-blue-50 border-blue-100"
          />
          <CompactStat
            icon={<Clock className="h-3 w-3" />}
            label="In Progress"
            value={stats.inProgress}
            className="text-amber-600 bg-amber-50 border-amber-100"
          />
          <CompactStat
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="Done"
            value={stats.completed}
            className="text-emerald-600 bg-emerald-50 border-emerald-100"
          />
          {stats.overdue > 0 && (
            <CompactStat
              icon={<AlertCircle className="h-3 w-3" />}
              label="Overdue"
              value={stats.overdue}
              className="text-red-600 bg-red-50 border-red-200"
            />
          )}
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <HomeSection title="Tasks">
          {/* View Toggle */}
          <div className="flex items-center gap-1.5 mb-5 p-1 bg-gray-100 rounded-lg w-fit">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={`h-8 gap-2 px-3 rounded-md text-sm font-medium transition-all ${
                viewMode === "calendar"
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-8 gap-2 px-3 rounded-md text-sm font-medium transition-all ${
                viewMode === "list"
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>

          {/* View Content */}
          {viewMode === "calendar" ? (
            <CalendarView tasks={tasks} workspaceId={workspaceId!} />
          ) : (
            <div className="grid gap-3">
              {tasks.length === 0 ? (
                <div className="p-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                  <LayoutList className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium">
                    No tasks assigned yet
                  </p>
                  <p className="text-xs text-gray-400">
                    Tasks assigned to you will appear here
                  </p>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskItem
                    key={task._id}
                    task={task}
                    workspaceId={workspaceId!}
                  />
                ))
              )}
            </div>
          )}
        </HomeSection>
      </div>
    </div>
  );
}

function CompactStat({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${className}`}
    >
      {icon}
      <span className="font-bold">{value}</span>
      <span className="font-medium opacity-75">{label}</span>
    </div>
  );
}

function TaskItem({ task, workspaceId }: { task: Task; workspaceId: string }) {
  const isOverdue =
    task.dueDate &&
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate)) &&
    task.columnId !== "done";
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));
  const isCompleted = task.columnId === "done";
  const projectData = task.project as any;

  return (
    <Link
      to={`/${workspaceId}/projects/${projectData?._id || task.project}/tasks`}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer group ${
        isOverdue
          ? "border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300"
          : isCompleted
            ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300"
            : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Project Icon */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl shadow-sm">
        {projectData?.emoji || "📋"}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3
            className={`font-semibold text-sm truncate transition-colors group-hover:text-primary ${
              isCompleted ? "line-through text-gray-400" : "text-gray-900"
            }`}
          >
            {task.title}
          </h3>
          {isCompleted && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              Done
            </span>
          )}
          {isOverdue && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              Overdue
            </span>
          )}
          {isDueToday && !isCompleted && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              Due Today
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project name */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <FolderOpen className="h-3 w-3" />
            <span className="font-medium">
              {projectData?.name || "Project"}
            </span>
          </div>

          {/* Column */}
          {task.columnId && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
              <span>{task.columnId}</span>
            </div>
          )}

          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <User2 className="h-3 w-3" />
              <span>{task.assignee.name}</span>
            </div>
          )}

          {/* Due date */}
          {task.dueDate && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                isOverdue
                  ? "text-red-600"
                  : isDueToday
                    ? "text-amber-600"
                    : "text-gray-400"
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), "MMM d, yyyy")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover Indicator */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4 text-primary" />
        </div>
      </div>
    </Link>
  );
}
