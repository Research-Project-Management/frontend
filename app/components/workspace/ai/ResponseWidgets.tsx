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
    default: "bg-[#3370ff]/10 text-[#3370ff]",
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    bad: "bg-red-500/10 text-red-600",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{value}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function TaskOverviewWidget({ widget }: { widget: Extract<ResponseWidget, { type: "task_overview" }> }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-sidebar shadow-sm">
      <div className="flex items-start gap-3 border-b border-border bg-background px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#3370ff]/10 text-[#3370ff]">
          <ListTodo className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{widget.title}</h3>
          {widget.subtitle && <p className="text-xs text-muted-foreground">{widget.subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <MetricPill icon={ListTodo} label="Total" value={widget.total} />
        <MetricPill icon={CircleDot} label="Active" value={widget.inProgress} />
        <MetricPill icon={CheckCircle2} label="Done" value={widget.done} tone="good" />
        <MetricPill icon={AlertTriangle} label="Overdue" value={widget.overdue} tone={widget.overdue ? "bad" : "default"} />
      </div>

      <div className="space-y-2 px-3 pb-3">
        {widget.groups.slice(0, 4).map((group) => (
          <div key={group.label} className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{group.label}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {group.tasks.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {group.tasks.slice(0, 5).map((task) => {
                const priority = normalizePriority(task.priority);
                return (
                  <div key={task.id || task.title} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {task.title}
                    </span>
                    {task.assignee && (
                      <span className="hidden max-w-24 items-center gap-1 truncate text-[11px] text-muted-foreground sm:inline-flex">
                        <UserRound className="size-3" />
                        {task.assignee}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:inline-flex">
                        <Clock3 className="size-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
                      {priority.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
