import { AlertTriangle, CheckCircle2, CircleDot, Clock3, ListTodo, UserRound, type LucideIcon } from "lucide-react";
import type { AgentAction, ResponseWidget } from "~/types/chat";

type TaskLike = {
  id?: string;
  title?: string;
  priority?: string;
  assignee?: { name?: string } | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  completed?: boolean;
  columnName?: string;
  project?: { name?: string; avatar?: string } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizePriority(priority?: string) {
  const value = (priority || "none").toLowerCase();
  if (value === "urgent") return { label: "Urgent", className: "bg-red-500/10 text-red-600" };
  if (value === "high") return { label: "High", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  if (value === "medium") return { label: "Medium", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" };
  if (value === "low") return { label: "Low", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
  return { label: "None", className: "bg-muted text-muted-foreground" };
}

function normalizeTask(task: TaskLike) {
  return {
    id: task.id,
    title: task.title || "Untitled task",
    priority: task.priority || "none",
    assignee: task.assignee?.name || "",
    dueDate: task.dueDate || null,
    isOverdue: Boolean(task.isOverdue),
    completed: Boolean(task.completed),
    project: task.project ? { name: task.project.name || "Unknown Project", avatar: task.project.avatar } : null,
  };
}

function buildTaskWidget(tool: string, output: Record<string, unknown>): ResponseWidget | null {
  const rawColumns = asRecord(output.columns);
  const rawTasks = Array.isArray(output.tasks) ? (output.tasks as TaskLike[]) : [];

  if (!rawColumns && rawTasks.length === 0) return null;

  const groups = rawColumns
    ? Object.entries(rawColumns)
        .map(([label, tasks]) => ({
          label,
          tasks: Array.isArray(tasks) ? (tasks as TaskLike[]).map(normalizeTask) : [],
        }))
        .filter((group) => group.tasks.length > 0)
    : Object.entries(
        rawTasks.reduce<Record<string, TaskLike[]>>((acc, task) => {
          const key = task.columnName || (task.completed ? "Done" : "Active");
          acc[key] = acc[key] || [];
          acc[key].push(task);
          return acc;
        }, {}),
      ).map(([label, tasks]) => ({ label, tasks: tasks.map(normalizeTask) }));

  const tasks = groups.flatMap((group) => group.tasks);
  const total = Number(output.total ?? tasks.length);
  const done = tasks.filter((task) => task.completed).length;
  const overdue = tasks.filter((task) => task.isOverdue).length;
  const inProgress = tasks.filter((task) => !task.completed && !task.isOverdue).length;

  return {
    type: "task_overview",
    title: tool === "get_my_tasks" ? "My Tasks" : String(output.projectName || "Task Overview"),
    subtitle: tool === "get_my_tasks" ? "Assigned to you" : "Current board snapshot",
    total,
    done,
    inProgress,
    overdue,
    groups,
  };
}

export function buildResponseWidgetsFromActions(actions: AgentAction[]): ResponseWidget[] {
  const widgets: ResponseWidget[] = [];
  const seen = new Set<string>();

  for (const action of actions) {
    if (action.status !== "done" && action.type !== "tool_end") continue;
    const tool = action.tool || "";
    const output = asRecord(action.output);
    if (!tool || !output || output.error) continue;

    const key = `${tool}:${JSON.stringify(output).slice(0, 120)}`;
    if (seen.has(key)) continue;

    if (tool === "list_tasks" || tool === "get_my_tasks") {
      const widget = buildTaskWidget(tool, output);
      if (widget) {
        widgets.push(widget);
        seen.add(key);
      }
    }
  }

  return widgets;
}

function MetricPill({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    default: "bg-[#3370ff]/10 text-[#3370ff] border-[#3370ff]/20",
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    bad: "bg-red-500/10 text-red-600 border-red-500/20",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 shadow-xs transition-all duration-150 hover:shadow-xs hover:border-border/80">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground leading-tight">{value}</span>
        <span className="block truncate text-[10px] font-semibold text-muted-foreground/80 mt-0.5 leading-none">{label}</span>
      </span>
    </div>
  );
}

function TaskOverviewWidget({ widget }: { widget: Extract<ResponseWidget, { type: "task_overview" }> }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/80 bg-sidebar/30 backdrop-blur-xs shadow-xs select-none">
      <div className="flex items-center gap-3 border-b border-border/70 bg-background px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#3370ff]/10 text-[#3370ff]">
          <ListTodo className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground leading-tight">{widget.title}</h3>
          {widget.subtitle && <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{widget.subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <MetricPill icon={ListTodo} label="Total" value={widget.total} />
        <MetricPill icon={CircleDot} label="Active" value={widget.inProgress} />
        <MetricPill icon={CheckCircle2} label="Done" value={widget.done} tone="good" />
        <MetricPill icon={AlertTriangle} label="Overdue" value={widget.overdue} tone={widget.overdue ? "bad" : "default"} />
      </div>

      <div className="space-y-3 px-3 pb-3">
        {widget.groups.slice(0, 5).map((group) => {
          const displayLabel = group.label.charAt(0).toUpperCase() + group.label.slice(1);
          
          return (
            <div key={group.label} className="rounded-xl border border-border/70 bg-background/50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{displayLabel}</span>
                <span className="rounded-full bg-[#e6eeff] dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-[#3370ff]">
                  {group.tasks.length}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {group.tasks.slice(0, 6).map((task) => {
                  const priority = normalizePriority(task.priority);
                  return (
                    <div key={task.id || task.title} className="flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/10 transition-colors">
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground/90">
                        {task.title}
                      </span>
                      
                      {task.project && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#3370ff]/8 border border-[#3370ff]/15 text-[#3370ff] max-w-[120px] select-none shrink-0 font-medium">
                          {task.project.avatar ? (
                            <span className="text-[10px] leading-none shrink-0">{task.project.avatar}</span>
                          ) : (
                            <span className="size-1 rounded-full bg-[#3370ff] shrink-0" />
                          )}
                          <span className="truncate">{task.project.name}</span>
                        </span>
                      )}

                      {task.assignee && (
                        <span className="hidden max-w-24 items-center gap-1 truncate text-[10px] font-medium text-muted-foreground/85 sm:inline-flex bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded-md shrink-0">
                          <UserRound className="size-2.5" />
                          <span className="truncate">{task.assignee}</span>
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="hidden items-center gap-1 text-[10px] font-medium text-muted-foreground/85 md:inline-flex bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded-md shrink-0">
                          <Clock3 className="size-2.5" />
                          {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {priority.label !== "None" && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase select-none shrink-0 ${priority.className}`}>
                          {priority.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResponseWidgets({ widgets }: { widgets?: ResponseWidget[] }) {
  if (!widgets?.length) return null;

  return (
    <div className="space-y-2">
      {widgets.map((widget, index) => {
        if (widget.type === "task_overview") {
          return <TaskOverviewWidget key={`task-${index}`} widget={widget} />;
        }
        return null;
      })}
    </div>
  );
}
