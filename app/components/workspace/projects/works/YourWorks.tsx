import {
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  UserStar,
  Loader2,
  List,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { useWorkspaceTasks } from "~/query/task";
import type { Task } from "~/types/task";
import { format, isPast } from "date-fns";
import CalendarView from "./CalendarView";
import HomeSection from "../Home/HomeSection";
import Header from "../layout/Header";

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { data: tasks = [], isLoading } = useWorkspaceTasks(workspaceId || "");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(
      (t) => t.dueDate && isPast(new Date(t.dueDate)),
    ).length;

    return {
      total,
      inProgress: tasks.filter((t) => t.columnId && t.columnId !== "done")
        .length,
      completed: tasks.filter((t) => t.columnId === "done").length,
      overdue,
    };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Your Works" Icon={UserStar} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <Header title="Your Works" Icon={UserStar} />
  

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        {/* Stats - Simplified */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Total Tasks"
            value={stats.total}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="In Progress"
            value={stats.inProgress}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completed"
            value={stats.completed}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Overdue"
            value={stats.overdue}
            variant="danger"
          />
        </div>

        <HomeSection title="Tasks">
          {/* View Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="h-8 gap-2"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
          </div>

          {/* View Content */}
          {viewMode === "list" ? (
            <div className="grid gap-3">
              {tasks.length === 0 ? (
                <div className="p-4 min-h-32 bg-secondary rounded-lg text-center flex items-center justify-center text-gray-500">
                  No tasks found
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
          ) : (
            <CalendarView tasks={tasks} workspaceId={workspaceId!} />
          )}
        </HomeSection>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "default" | "danger";
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="text-gray-600">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">{label}</div>
        <div
          className={`text-xl font-semibold ${variant === "danger" ? "text-red-600" : "text-gray-900"}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, workspaceId }: { task: Task; workspaceId: string }) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
  const projectData = task.project as any;

  return (
    <Link
      to={`/${workspaceId}/projects/${projectData?._id || task.project}/tasks`}
      className="flex items-center gap-4 px-2 transition-all duration-200 cursor-pointer group"
    >
      {/* Project Icon */}
      <span className="text-xl">{projectData?.emoji || "📋"}</span>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium hover:underline underline-offset-2 text-gray-900 group-hover:text-primary transition-all truncate">
          {task.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium">{projectData?.name || "Project"}</span>
          {task.columnId && (
            <>
              <span>•</span>
              <span>{task.columnId}</span>
            </>
          )}
          {task.dueDate && (
            <>
              <span>•</span>
              <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                {format(new Date(task.dueDate), "MMM d, yyyy")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Hover Indicator */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-primary" />
      </div>
    </Link>
  );
}
