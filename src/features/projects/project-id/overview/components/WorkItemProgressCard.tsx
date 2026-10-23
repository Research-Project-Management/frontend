'use client';

import React from 'react';
import Link from 'next/link';
import { WorkItemMetrics } from '../types/overview.types';
import {
  CheckCircle2,
  Clock,
  CircleDot,
  Inbox,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Plus,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface WorkItemProgressCardProps {
  projectId: string;
  metrics: WorkItemMetrics;
}

export function WorkItemProgressCard({
  projectId,
  metrics,
}: WorkItemProgressCardProps) {
  const {
    completed = 0,
    started = 0,
    unstarted = 0,
    backlog = 0,
    overdue = 0,
    cancelled = 0,
    completionPercentage = 0,
  } = metrics || {};

  const totalCount =
    metrics?.totalWorkItems ??
    (metrics as { totalIssues?: number })?.totalIssues ??
    0;

  // Calculate percentages
  const actionableTotal = Math.max(0, totalCount - cancelled);
  const completedPct = actionableTotal > 0 ? (completed / actionableTotal) * 100 : 0;
  const startedPct = actionableTotal > 0 ? (started / actionableTotal) * 100 : 0;
  const unstartedPct = actionableTotal > 0 ? (unstarted / actionableTotal) * 100 : 0;
  const backlogPct = actionableTotal > 0 ? (backlog / actionableTotal) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <BarChart2 className="size-3.5" />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-13 font-semibold tracking-tight text-foreground">
              Work Items Progress
            </h2>
            <span className="text-12 font-medium text-muted-foreground">
              ({totalCount} total)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <Link href={`/projects/${projectId}/work-items`}>
              <span>View all</span>
              <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-12">
          <span className="text-muted-foreground font-medium">Completion rate</span>
          <span className="font-semibold text-foreground font-mono">
            {completionPercentage}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
          {completedPct > 0 && (
            <div
              style={{ width: `${completedPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Completed: ${completed} (${completedPct.toFixed(1)}%)`}
            />
          )}
          {startedPct > 0 && (
            <div
              style={{ width: `${startedPct}%` }}
              className="h-full bg-amber-500 transition-all duration-300"
              title={`In Progress: ${started} (${startedPct.toFixed(1)}%)`}
            />
          )}
          {unstartedPct > 0 && (
            <div
              style={{ width: `${unstartedPct}%` }}
              className="h-full bg-blue-500/80 transition-all duration-300"
              title={`Unstarted: ${unstarted} (${unstartedPct.toFixed(1)}%)`}
            />
          )}
          {backlogPct > 0 && (
            <div
              style={{ width: `${backlogPct}%` }}
              className="h-full bg-zinc-400 dark:bg-zinc-600 transition-all duration-300"
              title={`Backlog: ${backlog} (${backlogPct.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legend / State Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* Completed */}
          <Link
            href={`/projects/${projectId}/work-items`}
            className="group flex flex-col p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                Completed
              </span>
              <CheckCircle2 className="size-3.5 text-muted-foreground/60 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-16 font-semibold text-foreground font-mono">
                {completed}
              </span>
              <span className="text-12 text-muted-foreground">
                {completedPct.toFixed(0)}%
              </span>
            </div>
          </Link>

          {/* In Progress / Started */}
          <Link
            href={`/projects/${projectId}/work-items`}
            className="group flex flex-col p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                In Progress
              </span>
              <Clock className="size-3.5 text-muted-foreground/60 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-16 font-semibold text-foreground font-mono">
                {started}
              </span>
              <span className="text-12 text-muted-foreground">
                {startedPct.toFixed(0)}%
              </span>
            </div>
          </Link>

          {/* Unstarted */}
          <Link
            href={`/projects/${projectId}/work-items`}
            className="group flex flex-col p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                Todo / Open
              </span>
              <CircleDot className="size-3.5 text-muted-foreground/60 group-hover:text-blue-500 transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-16 font-semibold text-foreground font-mono">
                {unstarted}
              </span>
              <span className="text-12 text-muted-foreground">
                {unstartedPct.toFixed(0)}%
              </span>
            </div>
          </Link>

          {/* Backlog */}
          <Link
            href={`/projects/${projectId}/work-items`}
            className="group flex flex-col p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                Backlog
              </span>
              <Inbox className="size-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-16 font-semibold text-foreground font-mono">
                {backlog}
              </span>
              <span className="text-12 text-muted-foreground">
                {backlogPct.toFixed(0)}%
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Overdue alert banner if > 0 */}
      {overdue > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-12 text-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span>
              <strong className="font-semibold text-foreground">{overdue}</strong>{' '}
              {overdue === 1 ? 'work item is' : 'work items are'} past due date
            </span>
          </div>
          <Link
            href={`/projects/${projectId}/work-items`}
            className="text-12 font-medium text-amber-600 dark:text-amber-400 hover:underline shrink-0"
          >
            Review overdue &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
