'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  ListTodo,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ResponseWidget } from '../../types/message';

function normalizePriority(priority?: string) {
  const value = (priority || 'none').toLowerCase();
  if (value === 'urgent') {
    return { label: 'Urgent', dotClass: 'bg-destructive' };
  }
  if (value === 'high') {
    return { label: 'High', dotClass: 'bg-warning' };
  }
  if (value === 'medium') {
    return { label: 'Medium', dotClass: 'bg-primary' };
  }
  if (value === 'low') {
    return { label: 'Low', dotClass: 'bg-success' };
  }
  return { label: 'None', dotClass: 'bg-muted-foreground' };
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
  const toneIndicator = {
    default: {
      dotClass: 'bg-muted-foreground',
      iconClass: 'text-muted-foreground',
    },
    good: { dotClass: 'bg-success', iconClass: 'text-success' },
    warn: { dotClass: 'bg-warning', iconClass: 'text-warning' },
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border border-border bg-card text-11 font-medium text-foreground shrink-0">
      <span
        className={cn('size-1.5 rounded-full shrink-0', toneIndicator.dotClass)}
        aria-hidden="true"
      />
      <Icon
        className={cn('size-3 shrink-0', toneIndicator.iconClass)}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function MetricSummaryCard({
  widget,
}: {
  widget: Extract<ResponseWidget, { type: 'metric_summary' }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground">
        {widget.title}
      </h4>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {widget.metrics.map((metric, i) => (
          <div key={i} className="border-t border-border/50 pt-2.5">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-foreground">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkItemOverviewCard({
  widget,
}: {
  widget: Extract<ResponseWidget, { type: 'work_item_overview' }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {widget.title}
          </h4>
          {widget.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {widget.subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-11">
          <StatBadge icon={ListTodo} label={`${widget.total} Total`} />
          <StatBadge
            icon={CheckCircle2}
            label={`${widget.done} Done`}
            tone="good"
          />
          {widget.overdue > 0 && (
            <StatBadge
              icon={AlertTriangle}
              label={`${widget.overdue} Overdue`}
              tone="warn"
            />
          )}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {widget.groups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
            <div className="divide-y divide-border-subtle">
              {group.workItems.map((item, itemIdx) => {
                const priority = normalizePriority(item.priority);
                return (
                  <div
                    key={item.id || itemIdx}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.completed ? (
                        <CheckCircle2
                          className="size-3.5 text-success shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <CircleDot
                          className="size-3.5 text-muted-foreground/60 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`truncate ${
                          item.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {item.project?.name && (
                        <span className="hidden sm:inline text-11 px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {item.project.name}
                        </span>
                      )}
                      {item.assignee && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="size-3 shrink-0" aria-hidden="true" />
                          <span>{item.assignee}</span>
                        </span>
                      )}
                      {item.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            item.isOverdue
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                          <span>
                            {new Date(item.dueDate).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                              },
                            )}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border border-border bg-card text-11 font-medium text-foreground shrink-0">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            priority.dotClass,
                          )}
                          aria-hidden="true"
                        />
                        <span>{priority.label}</span>
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

export function WidgetsPart({ widgets }: { widgets?: ResponseWidget[] }) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="my-2.5 space-y-2.5">
      {widgets.map((widget, index) =>
        widget.type === 'work_item_overview' ? (
          <WorkItemOverviewCard key={index} widget={widget} />
        ) : (
          <MetricSummaryCard key={index} widget={widget} />
        ),
      )}
    </div>
  );
}
