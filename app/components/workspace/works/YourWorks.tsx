import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Kanban,
  Tag,
  ArrowUpRight,
  UserStar,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "~/components/ui/progress";
import Header from "~/components/workspace/projects/layout/Header";
import { useWorkspaceTasks } from "~/query/task";
import type { Task } from "~/types/task";
import { format, isPast } from "date-fns";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="w-full">
    <h2 className="text-primary/50 font-semibold mb-4">{title}</h2>
    <div className="relative">{children}</div>
  </div>
);

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { data: tasks = [], isLoading } = useWorkspaceTasks(workspaceId || "");
  const [filterColumn, setFilterColumn] = useState<string>("all");

  // Get unique columns from tasks
  const columns = useMemo(() => {
    const columnSet = new Set<string>();
    tasks.forEach((task) => {
      if (task.columnId) columnSet.add(task.columnId);
    });
    return Array.from(columnSet);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterColumn !== "all" && task.columnId !== filterColumn)
        return false;
      return true;
    });
  }, [tasks, filterColumn]);

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
      <Header title="Your Works" Icon={UserStar} />

      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Kanban className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </span>
            </div>
            <div className="text-2xl font-bold pl-1">{stats.total}</div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                In Progress
              </span>
            </div>
            <div className="text-2xl font-bold pl-1">{stats.inProgress}</div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Completed
              </span>
            </div>
            <div className="text-2xl font-bold pl-1">{stats.completed}</div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Overdue
              </span>
            </div>
            <div className="text-2xl font-bold pl-1 text-red-500">
              {stats.overdue}
            </div>
          </div>
        </div>

        <Section title="Tasks">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Filters:
            </span>

            <Select value={filterColumn} onValueChange={setFilterColumn}>
              <SelectTrigger className="w-40 h-9 bg-background border border-input hover:border-primary/50 transition-colors focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Columns</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filterColumn !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterColumn("all")}
                className="h-9 hover:bg-secondary/20"
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Tasks List */}
          <div className="grid gap-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No tasks found
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskItem
                  key={task._id}
                  task={task}
                  workspaceId={workspaceId!}
                />
              ))
            )}
          </div>
        </Section>
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
      className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-secondary/50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-border/50"
    >
      {/* Project Icon */}
      <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-secondary/30 text-lg group-hover:bg-background transition-colors">
        {projectData?.emoji || "📋"}
      </div>

      {/* Main Content */}
      <div className="flex-1 grid gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {task.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {projectData?.name || "Project"}
          </span>
          {task.columnId && (
            <>
              <span>•</span>
              <span className="font-medium">{task.columnId}</span>
            </>
          )}
          {task.dueDate && (
            <>
              <span>•</span>
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                {format(new Date(task.dueDate), "MMM d, yyyy")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Actions / Meta */}
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.labels?.slice(0, 2).map((label) => (
          <span
            key={label}
            className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground uppercase tracking-wider"
          >
            {label}
          </span>
        ))}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  );
}
