'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Users,
  Tag,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { WorkloadCards } from '@/features/projects/your-work/components/summary/WorkloadCards';
import { BreakdownCard } from '@/features/projects/your-work/components/summary/BreakdownCard';
import { useProjectAnalytics } from '../hooks/use-project-analytics';
import { cn } from '@/shared/lib/utils';

const PriorityBreakdown = dynamic(
  () =>
    import('@/features/projects/your-work/components/summary/PriorityBreakdown').then(
      (m) => m.PriorityBreakdown,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-md" />,
  },
);

const StateBreakdown = dynamic(
  () =>
    import('@/features/projects/your-work/components/summary/StateBreakdown').then(
      (m) => m.StateBreakdown,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-md" />,
  },
);

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
] as const;

export function ProjectAnalyticsPage() {
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId || '';
  const [rangeDays, setRangeDays] = useState<number>(14);

  const {
    analytics,
    timeSeries,
    isLoading,
    isError,
    error,
  } = useProjectAnalytics(projectId, rangeDays);

  const totalItems = analytics?.totalItems ?? 0;
  const completedItems = analytics?.completedItems ?? 0;
  const inProgressItems = analytics?.inProgressItems ?? 0;
  const overdueItems = analytics?.overdueItems ?? 0;
  const completionRate = analytics?.completionRate ?? 0;
  const stateGroups = analytics?.stateGroups ?? {};
  const priority = analytics?.priority ?? {};
  const assignees = analytics?.assignee ?? [];
  const labels = analytics?.labels ?? [];

  const kpiCards = [
    {
      label: 'Total work items',
      value: totalItems,
      sub: `${analytics?.unassignedItems ?? 0} unassigned`,
      icon: Layers,
    },
    {
      label: 'Completed',
      value: `${completedItems} (${completionRate}%)`,
      sub: 'Actionable completion rate',
      icon: CheckCircle2,
    },
    {
      label: 'In progress',
      value: inProgressItems,
      sub: 'Active research tasks',
      icon: Clock,
    },
    {
      label: 'Overdue',
      value: overdueItems,
      sub: overdueItems > 0 ? 'Needs attention' : 'On schedule',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Top Header (Matching Your Work & Storage pattern) ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BarChart3 className="size-4 text-foreground shrink-0" />
          <h1 className="text-13 font-semibold text-foreground tracking-tight">
            Analytics
          </h1>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 rounded-md bg-muted/60 p-0.5 border border-border/60">
          {RANGE_OPTIONS.map((opt) => {
            const active = rangeDays === opt.days;
            return (
              <button
                key={opt.days}
                type="button"
                onClick={() => setRangeDays(opt.days)}
                className={cn(
                  'h-6 px-2.5 rounded-[5px] text-11 font-medium transition-colors cursor-pointer outline-none',
                  active
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-6 max-w-6xl mx-auto p-6">
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Skeleton className="h-18 rounded-md" />
                <Skeleton className="h-18 rounded-md" />
                <Skeleton className="h-18 rounded-md" />
                <Skeleton className="h-18 rounded-md" />
                <Skeleton className="h-18 rounded-md" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-72 rounded-md" />
              <Skeleton className="h-72 rounded-md" />
            </div>
          </div>
        ) : isError ? (
          <div className="max-w-6xl mx-auto p-6">
            <PlaneErrorState
              title="Unable to load project analytics"
              description="An error occurred while loading project metrics and workload distribution."
              error={error || new Error('Internal Server Error')}
            />
          </div>
        ) : totalItems === 0 ? (
          <div className="max-w-6xl mx-auto p-6 min-h-[420px] flex items-center justify-center">
            <PlaneEmptyState
              variant="default"
              title="No analytics data yet"
              description="Create work items and assign collaborators in this project to visualize progress, state distributions, and team workload."
            />
          </div>
        ) : (
          <div className="space-y-6 max-w-6xl mx-auto p-6">
            {/* 1. Overview KPI Cards */}
            <div>
              <h2 className="text-13 font-semibold text-foreground tracking-tight mb-2.5">
                Overview
              </h2>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex items-center gap-3.5 p-3.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      <div className="size-10 rounded-md bg-background/80 flex items-center justify-center text-foreground shrink-0">
                        <Icon className="size-5 text-foreground shrink-0" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-12 text-muted-foreground font-normal truncate">
                          {card.label}
                        </p>
                        <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
                          {card.value}
                        </p>
                        <p className="text-11 text-muted-foreground truncate">
                          {card.sub}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Workload across 5 Canonical State Groups */}
            <WorkloadCards statusBreakdown={stateGroups} />

            {/* 3. Priority & State Donut Breakdown (Reusing Your Work Summary charts) */}
            <div className="grid gap-4 md:grid-cols-2">
              <PriorityBreakdown
                priorityBreakdown={priority}
                total={totalItems}
              />
              <StateBreakdown
                statusBreakdown={stateGroups}
                total={totalItems}
              />
            </div>

            {/* 4. Activity Velocity (Created vs Completed Time-Series) & Labels */}
            <div className="grid gap-4 md:grid-cols-2">
              <BreakdownCard
                title={`Velocity trend (Last ${rangeDays} days)`}
                isEmpty={timeSeries.length === 0}
                emptyText="No activity recorded in this period"
              >
                {(isMounted) => (
                  <div className="flex flex-col justify-between h-full space-y-3">
                    <div className="h-[195px] w-full">
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={timeSeries}
                            margin={{ top: 10, right: 12, left: -24, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              className="stroke-border/40"
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(d: string) => d.slice(5)}
                              tickLine={false}
                              axisLine={false}
                              className="text-11 fill-muted-foreground"
                              dy={6}
                            />
                            <YAxis
                              allowDecimals={false}
                              tickLine={false}
                              axisLine={false}
                              className="text-11 fill-muted-foreground"
                              width={32}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: 'var(--popover)',
                                borderColor: 'var(--border)',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="created"
                              name="Created"
                              stroke="#3B82F6"
                              fill="#3B82F6"
                              fillOpacity={0.14}
                              strokeWidth={2}
                            />
                            <Area
                              type="monotone"
                              dataKey="completed"
                              name="Completed"
                              stroke="#10B981"
                              fill="#10B981"
                              fillOpacity={0.18}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <Skeleton className="h-full w-full rounded-md" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-12">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full bg-[#3B82F6]" />
                          Created
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full bg-[#10B981]" />
                          Completed
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-11 text-muted-foreground">
                        <TrendingUp className="size-3.5" />
                        Daily trend
                      </span>
                    </div>
                  </div>
                )}
              </BreakdownCard>

              {/* Label Distribution */}
              <div className="flex flex-col gap-2">
                <h3 className="text-13 font-semibold text-foreground tracking-tight">
                  Work items by label
                </h3>
                <div className="rounded-md bg-muted/40 p-5 min-h-[290px] flex flex-col justify-between">
                  {labels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-auto text-center py-6">
                      <Tag className="size-6 text-muted-foreground/40 mb-2" />
                      <span className="text-12 text-muted-foreground">
                        No labels assigned to work items yet
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3 my-auto">
                      {labels.slice(0, 7).map((item) => {
                        const pct =
                          totalItems > 0
                            ? Math.round((item.count / totalItems) * 100)
                            : 0;
                        return (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex items-center justify-between text-12">
                              <span className="flex items-center gap-2 font-medium text-foreground truncate">
                                <span
                                  className="size-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: item.color || '#6366f1',
                                  }}
                                />
                                <span className="truncate">{item.label}</span>
                              </span>
                              <span className="text-11 text-muted-foreground tabular-nums shrink-0">
                                {item.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-background/80 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: item.color || '#6366f1',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Collaborator Workload Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-13 font-semibold text-foreground tracking-tight">
                  Member workload
                </h3>
                <span className="text-11 text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {assignees.length} assigned member{assignees.length === 1 ? '' : 's'}
                </span>
              </div>

              {assignees.length === 0 ? (
                <div className="rounded-md bg-muted/40 p-6 text-center text-12 text-muted-foreground">
                  No work items have been assigned to project members yet.
                </div>
              ) : (
                <div className="rounded-md bg-muted/40 overflow-hidden divide-y divide-border/50">
                  <div className="grid grid-cols-12 px-4 py-2.5 text-11 font-medium text-muted-foreground bg-muted/60">
                    <div className="col-span-5">Member</div>
                    <div className="col-span-2 text-right">Assigned</div>
                    <div className="col-span-2 text-right hidden sm:block">
                      In progress
                    </div>
                    <div className="col-span-3 text-right">Completed</div>
                  </div>
                  {assignees.map((member) => {
                    const memberCompletionPct =
                      member.count > 0
                        ? Math.round(
                            ((member.completedCount ?? 0) / member.count) * 100,
                          )
                        : 0;
                    return (
                      <div
                        key={member.userId}
                        className="grid grid-cols-12 items-center px-4 py-3 text-12 hover:bg-muted/70 transition-colors"
                      >
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-6 text-10 shrink-0">
                            {member.avatar && (
                              <AvatarImage src={member.avatar} alt={member.name} />
                            )}
                            <AvatarFallback>
                              {member.name?.slice(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground truncate">
                            {member.name}
                          </span>
                          {(member.overdueCount ?? 0) > 0 && (
                            <span className="text-10 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium shrink-0">
                              {member.overdueCount} overdue
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-right font-medium tabular-nums text-foreground">
                          {member.count}
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-muted-foreground hidden sm:block">
                          {member.inProgressCount ?? 0}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          <span className="tabular-nums text-foreground font-medium">
                            {member.completedCount ?? 0}
                          </span>
                          <span className="text-11 text-muted-foreground tabular-nums w-10 text-right">
                            ({memberCompletionPct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProjectAnalyticsPage;
