import { AlertTriangle, CheckCircle2, CircleDot, Clock3, ListTodo, UserRound, type LucideIcon } from 'lucide-react';
import type { AgentAction, ResponseWidget } from '../../types/chat.types';

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
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
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
  const value = (priority || 'none').toLowerCase();
  if (value === 'urgent') return { label: 'Urgent', className: 'bg-red-500/10 text-red-600' };
  if (value === 'high') return { label: 'High', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
  if (value === 'medium') return { label: 'Medium', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' };
  if (value === 'low') return { label: 'Low', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' };
  return { label: 'None', className: 'bg-muted text-muted-foreground' };
}

function normalizeTask(task: TaskLike) {
  return {
    id: task.id,
    title: task.title || 'Untitled task',
    priority: task.priority || 'none',
    assignee: task.assignee?.name || '',
    dueDate: task.dueDate || null,
    isOverdue: Boolean(task.isOverdue),
    completed: Boolean(task.completed),
    project: task.project ? { name: task.project.name || 'Unknown Project', avatar: task.project.avatar } : null,
  };
}

function buildTaskWidget(tool: string, output: Record<string, unknown>): ResponseWidget | null {
  const rawColumns = asRecord(output.columns);
  const rawTasks = Array.isArray(output.tasks) ? (output.tasks as TaskLike[]) : [];

  if (!rawColumns && rawTasks.length === 0) return null;

  const groups = rawColumns
    ? Object.entries(rawColumns)
        .map(([columnName, tasks]) => ({
          label: columnName,
          tasks: Array.isArray(tasks) ? tasks.map((task) => normalizeTask(task as TaskLike)) : [],
        }))
        .filter((group) => group.tasks.length > 0)
    : [
        {
          label: tool === 'get_my_tasks' ? 'Assigned to you' : 'Tasks',
          tasks: rawTasks.map(normalizeTask),
        },
      ];

  const allTasks = groups.flatMap((group) => group.tasks);
  const done = allTasks.filter((task) => task.completed).length;
  const overdue = allTasks.filter((task) => task.isOverdue).length;

  return {
    type: 'task_overview',
    title: tool === 'get_my_tasks' ? 'My Tasks Overview' : 'Workspace Tasks Overview',
    subtitle: `${allTasks.length} task${allTasks.length === 1 ? '' : 's'} tracked across this view`,
    total: allTasks.length,
    done,
    inProgress: Math.max(allTasks.length - done, 0),
    overdue,
    groups,
  };
}

function buildMetricWidget(output: Record<string, unknown>): ResponseWidget | null {
  const metrics: Array<{ label: string; value: string | number; tone?: 'default' | 'good' | 'warn' | 'bad' }> = [];

  if (typeof output.total_tasks === 'number') {
    metrics.push({ label: 'Total Tasks', value: output.total_tasks });
  }
  if (typeof output.completed_tasks === 'number') {
    metrics.push({ label: 'Completed', value: output.completed_tasks, tone: 'good' });
  }
  if (typeof output.overdue_tasks === 'number') {
    metrics.push({
      label: 'Overdue',
      value: output.overdue_tasks,
      tone: output.overdue_tasks > 0 ? 'warn' : 'default',
    });
  }
  if (typeof output.completion_rate === 'number') {
    metrics.push({
      label: 'Completion Rate',
      value: `${Math.round(output.completion_rate * 100)}%`,
      tone: output.completion_rate >= 0.7 ? 'good' : 'default',
    });
  }

  if (metrics.length === 0) return null;

  return {
    type: 'metric_summary',
    title: 'Workload Summary',
    metrics,
  };
}

export function buildResponseWidgetsFromActions(actions: AgentAction[]): ResponseWidget[] {
  const widgets: ResponseWidget[] = [];

  for (const action of actions) {
    if (action.type !== 'tool_call' || action.status !== 'done' || !action.output || !action.tool) {
      continue;
    }

    if (action.tool === 'list_tasks' || action.tool === 'get_my_tasks') {
      const widget = buildTaskWidget(action.tool, action.output);
      if (widget) widgets.push(widget);
      continue;
    }

    if (action.tool === 'summarize_member_tasks' || action.tool === 'get_workload_distribution') {
      const widget = buildMetricWidget(action.output);
      if (widget) widgets.push(widget);
    }
  }

  return widgets;
}

export function ResponseWidgets({ widgets }: { widgets?: ResponseWidget[] }) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="my-3 space-y-3">
      {widgets.map((widget, index) => {
        if (widget.type === 'task_overview') {
          return <TaskOverviewCard key={index} widget={widget} />;
        }
        return <MetricSummaryCard key={index} widget={widget} />;
      })}
    </div>
  );
}

function MetricSummaryCard({ widget }: { widget: Extract<ResponseWidget, { type: 'metric_summary' }> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{widget.title}</h4>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {widget.metrics.map((metric, i) => (
          <div key={i} className="rounded-lg bg-secondary/40 p-3">
            <p className="text-[11px] text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskOverviewCard({ widget }: { widget: Extract<ResponseWidget, { type: 'task_overview' }> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{widget.title}</h4>
          {widget.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{widget.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatBadge icon={ListTodo} label={`${widget.total} Total`} />
          <StatBadge icon={CheckCircle2} label={`${widget.done} Done`} tone="good" />
          {widget.overdue > 0 && <StatBadge icon={AlertTriangle} label={`${widget.overdue} Overdue`} tone="warn" />}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {widget.groups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{group.label}</p>
            <div className="divide-y divide-border/30 rounded-lg border border-border/40 bg-secondary/20">
              {group.tasks.map((task, taskIdx) => {
                const priority = normalizePriority(task.priority);
                return (
                  <div key={task.id || taskIdx} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {task.completed ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <CircleDot className="size-3.5 text-muted-foreground/60 shrink-0" />
                      )}
                      <span className={`truncate ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.project?.name && (
                        <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {task.project.name}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <UserRound className="size-3" />
                          {task.assignee}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[10px] ${task.isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          <Clock3 className="size-3" />
                          {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priority.className}`}>
                        {priority.label}
                      </span>
                    </div>
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

function StatBadge({
  icon: Icon,
  label,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClasses = {
    default: 'bg-muted text-muted-foreground',
    good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${toneClasses[tone]}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}
