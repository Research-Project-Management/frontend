import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  List,
  LayoutList,
  CalendarDays,
  FolderOpen,
  FlaskConical,
  Target,
  AlertTriangle,
  Flag,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceTasks } from "~/query/task";
import type { Task } from "~/types/task";
import { PHASE_CONFIG, PRIORITY_CONFIG } from "~/types/task";
import type { CyclePhase } from "~/types/task";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import CalendarView from "./CalendarView";
import HomeSection from "../Home/HomeSection";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import PriorityBadge from "~/components/workspace/projects/$projectId/Task/PriorityBadge";
import { API_URL } from "~/lib/api";

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { data: tasks = [], isLoading: isLoadingTasks } = useWorkspaceTasks(
    workspaceId || "",
  );
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

  // Fetch research overview (cycles + deadlines)
  const { data: research, isLoading: isLoadingResearch } = useQuery({
    queryKey: ["my-research", workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/workspace/${workspaceId}/my-research`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  const cycles = research?.cycles || [];
  const deadlines = research?.deadlines || [];
  const isLoading = isLoadingTasks || isLoadingResearch;

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
      <div className="flex-1 p-6 space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip
            icon={<LayoutList className="size-3.5" />}
            label="Total"
            value={stats.total}
            color="var(--color-primary)"
          />
          <StatChip
            icon={<Clock className="size-3.5" />}
            label="In Progress"
            value={stats.inProgress}
            color="#eab308"
          />
          <StatChip
            icon={<CheckCircle2 className="size-3.5" />}
            label="Done"
            value={stats.completed}
            color="#22c55e"
          />
          {stats.overdue > 0 && (
            <StatChip
              icon={<Calendar className="size-3.5" />}
              label="Overdue"
              value={stats.overdue}
              color="#ef4444"
            />
          )}
          {cycles.length > 0 && (
            <StatChip
              icon={<FlaskConical className="size-3.5" />}
              label="Active Cycles"
              value={cycles.filter((c: any) => c.status === "active").length}
              color="#8b5cf6"
            />
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          {/* Left: Calendar / Task list */}
          <div className="flex-1 min-w-0">
            <HomeSection title="Assigned to you">
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 mb-4 p-0.5 bg-muted rounded-lg w-fit">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    viewMode === "calendar"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarDays className="size-3.5" />
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="size-3.5" />
                  List
                </button>
              </div>

              {viewMode === "calendar" ? (
                <CalendarView tasks={tasks} workspaceId={workspaceId!} />
              ) : (
                <div>
                  {tasks.length === 0 ? (
                    <div className="py-12 border border-dashed border-border rounded-lg text-center">
                      <LayoutList className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No tasks assigned yet
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Tasks assigned to you will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                      {tasks.map((task) => (
                        <TaskRow
                          key={task._id}
                          task={task}
                          workspaceId={workspaceId!}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </HomeSection>
          </div>

          {/* Right: Upcoming Deadlines + Research Cycles */}
          <div className="w-80 shrink-0 space-y-6">
            {/* Upcoming Deadlines */}
            <HomeSection title="Upcoming Deadlines">
              {deadlines.length === 0 ? (
                <div className="py-8 border border-dashed border-border rounded-lg text-center">
                  <Target className="size-6 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No upcoming deadlines
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {deadlines.map((item: any, i: number) => (
                    <DeadlineItem
                      key={`${item.type}-${item.id}-${i}`}
                      item={item}
                      workspaceId={workspaceId!}
                    />
                  ))}
                </div>
              )}
            </HomeSection>

            {/* Research Cycles */}
            {cycles.length > 0 && (
              <HomeSection title="Research Progress">
                <div className="space-y-3">
                  {cycles.map((cycle: any) => (
                    <CycleCard
                      key={cycle._id}
                      cycle={cycle}
                      workspaceId={workspaceId!}
                    />
                  ))}
                </div>
              </HomeSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle,
  workspaceId,
}: {
  cycle: any;
  workspaceId: string;
}) {
  const phase = PHASE_CONFIG[cycle.phase as CyclePhase] || PHASE_CONFIG.custom;
  const progress = cycle.stats?.progress || 0;
  const isActive = cycle.status === "active";

  return (
    <Link
      to={`/${workspaceId}/projects/${cycle.project?._id}/cycles`}
      className="group block border border-border rounded-lg p-4 hover:border-primary/30 hover:bg-accent/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: phase.color + "18",
                color: phase.color,
              }}
            >
              {phase.icon} {phase.label}
            </span>
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                Active
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {cycle.name}
          </h4>
          {cycle.project && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <FolderOpen className="size-3" />
              {cycle.project.name}
            </p>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            {cycle.stats?.completedTasks || 0}/{cycle.stats?.totalTasks || 0}{" "}
            tasks
          </span>
          <span className="font-medium" style={{ color: phase.color }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: phase.color,
            }}
          />
        </div>
      </div>

      {/* Date range */}
      {(cycle.startDate || cycle.endDate) && (
        <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
          <Calendar className="size-3" />
          {cycle.startDate && format(new Date(cycle.startDate), "dd/MM/yy")}
          {cycle.startDate && cycle.endDate && " → "}
          {cycle.endDate && format(new Date(cycle.endDate), "dd/MM/yy")}
        </p>
      )}
    </Link>
  );
}

// ─── Deadline Item (compact for sidebar) ──────────────────────────────────────

function DeadlineItem({
  item,
  workspaceId,
}: {
  item: any;
  workspaceId: string;
}) {
  const isMilestone = item.type === "milestone";
  const dueDate = new Date(item.dueDate);
  const isDueToday = isToday(dueDate);

  const href = isMilestone
    ? `/${workspaceId}/projects/${item.project?._id}/cycles`
    : `/${workspaceId}/projects/${item.project?._id}/tasks`;

  return (
    <Link
      to={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group hover:bg-accent/50 ${
        item.isOverdue ? "bg-destructive/5" : ""
      }`}
    >
      {/* Icon */}
      {isMilestone ? (
        <Flag
          className="size-3.5 shrink-0"
          style={{ color: item.isOverdue ? "#ef4444" : "#8b5cf6" }}
        />
      ) : (
        <PriorityBadge priority={item.priority || "none"} />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs truncate group-hover:text-primary transition-colors ${
            item.completed
              ? "line-through text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {item.title}
        </p>
        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
          <span>{item.project?.name || "Project"}</span>
          <span>·</span>
          <span
            className={
              item.isOverdue
                ? "text-destructive"
                : isDueToday
                  ? "text-yellow-600"
                  : ""
            }
          >
            {format(dueDate, "dd/MM")}
          </span>
        </p>
      </div>

      {/* Status */}
      {item.isOverdue && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium shrink-0">
          Overdue
        </span>
      )}
      {isDueToday && !item.completed && !item.isOverdue && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 font-medium shrink-0">
          Today
        </span>
      )}
    </Link>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
      <span style={{ color }} className="shrink-0">
        {icon}
      </span>
      <span className="text-lg font-bold text-foreground leading-none">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
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
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));
  const isCompleted = task.columnId === "done";
  const projectData = task.project as any;

  return (
    <Link
      to={`/${workspaceId}/projects/${projectData?._id || task.project}/tasks`}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors group"
    >
      <PriorityBadge priority={task.priority} />

      {task.identifier && (
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {task.identifier}
        </span>
      )}

      <span
        className={`text-sm flex-1 truncate group-hover:text-primary transition-colors ${
          isCompleted
            ? "line-through text-muted-foreground"
            : "text-foreground"
        }`}
      >
        {task.title}
      </span>

      {/* Status badges */}
      {isCompleted && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium shrink-0">
          Done
        </span>
      )}
      {isOverdue && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium shrink-0">
          Overdue
        </span>
      )}
      {isDueToday && !isCompleted && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 font-medium shrink-0">
          Today
        </span>
      )}

      {/* Project */}
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
        <FolderOpen className="size-3" />
        {projectData?.name || "Project"}
      </span>

      {/* Due date */}
      {task.dueDate && (
        <span
          className={`flex items-center gap-1 text-[11px] shrink-0 ${
            isOverdue
              ? "text-destructive"
              : isDueToday
                ? "text-yellow-600"
                : "text-muted-foreground"
          }`}
        >
          <Calendar className="size-3" />
          {format(new Date(task.dueDate), "dd/MM")}
        </span>
      )}

      {/* Assignee */}
      {task.assignee && (
        <Avatar className="size-5 shrink-0">
          <AvatarImage src={task.assignee.avatar} />
          <AvatarFallback className="text-[9px]">
            {task.assignee.name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}

      <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
