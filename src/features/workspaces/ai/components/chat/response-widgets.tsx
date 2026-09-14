import { AlertTriangle, CheckCircle2, CircleDot, Clock3, ListTodo, UserRound, type LucideIcon } from 'lucide-react';
import type { AgentAction, ResponseWidget } from '../../types/chat.types';

type WorkItemLike = {
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
  if (value === 'urgent') return { label: 'Urgent', className: 'bg-destructive/10 text-destructive' };
  if (value === 'high') return { label: 'High', className: 'bg-warning/10 text-warning' };
  if (value === 'medium') return { label: 'Medium', className: 'bg-primary/10 text-primary' };
  if (value === 'low') return { label: 'Low', className: 'bg-success/10 text-success' };
  return { label: 'None', className: 'bg-muted text-muted-foreground' };
}

function normalizeWorkItem(item: WorkItemLike) {
  return {
    id: item.id,
    title: item.title || 'Untitled work item',
    priority: item.priority || 'none',
    assignee: item.assignee?.name || '',
    dueDate: item.dueDate || null,
    isOverdue: Boolean(item.isOverdue),
    completed: Boolean(item.completed),
    project: item.project ? { name: item.project.name || 'Unknown Project', avatar: item.project.avatar } : null,
  };
}

function buildWorkItemWidget(tool: string, output: Record<string, unknown>): ResponseWidget | null {
  const rawColumns = asRecord(output.columns);
  const rawItems = Array.isArray(output.workItems) ? (output.workItems as WorkItemLike[]) : Array.isArray(output.items) ? (output.items as WorkItemLike[]) : [];

  if (!rawColumns && rawItems.length === 0) return null;

  const groups = rawColumns
    ? Object.entries(rawColumns)
        .map(([columnName, items]) => ({
          label: columnName,
          workItems: Array.isArray(items) ? items.map((item) => normalizeWorkItem(item as WorkItemLike)) : [],
        }))
        .filter((group) => group.workItems.length > 0)
    : [
        {
          label: tool === 'get_my_work_items' ? 'Assigned to you' : 'Work Items',
          workItems: rawItems.map(normalizeWorkItem),
        },
      ];

  const allItems = groups.flatMap((group) => group.workItems);
  const done = allItems.filter((item) => item.completed).length;
  const overdue = allItems.filter((item) => item.isOverdue).length;

  return {
    type: 'work_item_overview',
    title: tool === 'get_my_work_items' ? 'My Work Items Overview' : 'Workspace Work Items Overview',
    subtitle: `${allItems.length} work item${allItems.length === 1 ? '' : 's'} tracked across this view`,
    total: allItems.length,
    done,
    inProgress: Math.max(allItems.length - done, 0),
    overdue,
    groups,
  };
}

function buildMetricWidget(output: Record<string, unknown>): ResponseWidget | null {
  const metrics: Array<{ label: string; value: string | number; tone?: 'default' | 'good' | 'warn' | 'bad' }> = [];

  if (typeof output.total_work_items === 'number') {
    metrics.push({ label: 'Total Work Items', value: output.total_work_items });
  }
  if (typeof output.completed_work_items === 'number') {
    metrics.push({ label: 'Completed', value: output.completed_work_items, tone: 'good' });
  }
  if (typeof output.overdue_work_items === 'number') {
    metrics.push({
      label: 'Overdue',
      value: output.overdue_work_items,
      tone: output.overdue_work_items > 0 ? 'warn' : 'default',
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

    if (action.tool === 'list_work_items' || action.tool === 'get_my_work_items') {
      const widget = buildWorkItemWidget(action.tool, action.output);
      if (widget) widgets.push(widget);
      continue;
    }

    if (action.tool === 'summarize_member_work_items' || action.tool === 'get_workload_distribution') {
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
        if (widget.type === 'work_item_overview') {
          return <WorkItemOverviewCard key={index} widget={widget} />;
        }
        return <MetricSummaryCard key={index} widget={widget} />;
      })}
    </div>
  );
}

function MetricSummaryCard({ widget }: { widget: Extract<ResponseWidget, { type: 'metric_summary' }> }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-4 ">
      <h4 className="text-xs font-semibold text-muted-foreground">{widget.title}</h4>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {widget.metrics.map((metric, i) => (
          <div key={i} className="rounded-lg bg-secondary/40 p-3">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkItemOverviewCard({ widget }: { widget: Extract<ResponseWidget, { type: 'work_item_overview' }> }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 ">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
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
            <p className="text-xs font-medium text-muted-foreground/80">{group.label}</p>
            <div className="divide-y divide-border/30 rounded-lg border border-border bg-secondary/20">
              {group.workItems.map((item, itemIdx) => {
                const priority = normalizePriority(item.priority);
                return (
                  <div key={item.id || itemIdx} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.completed ? (
                        <CheckCircle2 className="size-3.5 text-success shrink-0" />
                      ) : (
                        <CircleDot className="size-3.5 text-muted-foreground/60 shrink-0" />
                      )}
                      <span className={`truncate ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.project?.name && (
                        <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.project.name}
                        </span>
                      )}
                      {item.assignee && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="size-3 shrink-0" />
                          {item.assignee}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-xs ${item.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          <Clock3 className="size-3 shrink-0" />
                          {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.className}`}>
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
    good: 'bg-success/10 text-success',
    warn: 'bg-warning/10 text-warning',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${toneClasses[tone]}`}>
      <Icon className="size-3 shrink-0" />
      {label}
    </span>
  );
}
