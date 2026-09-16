'use client';

import React from 'react';
import Link from 'next/link';
import { WorkItemMetrics } from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  CircleDot,
  Inbox,
  AlertTriangle,
  ArrowRight,
  BarChart2,
} from 'lucide-react';

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
    completionPercentage = 0,
  } = metrics || {};

  const totalCount = metrics?.totalWorkItems ?? (metrics as any)?.totalIssues ?? 0;
  const cancelledCount = metrics?.cancelled ?? 0;

  // Calculate segment widths
  const actionableTotal = Math.max(0, totalCount - cancelledCount);
  const completedPct = actionableTotal > 0 ? (completed / actionableTotal) * 100 : 0;
  const startedPct = actionableTotal > 0 ? (started / actionableTotal) * 100 : 0;
  const unstartedPct = actionableTotal > 0 ? (unstarted / actionableTotal) * 100 : 0;
  const backlogPct = actionableTotal > 0 ? (backlog / actionableTotal) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Work Items & Progress
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {completionPercentage}% completed
          </span>
          <Link
            href={`/projects/${projectId}/work-items`}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline ml-1"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden flex shadow-inner">
          {completedPct > 0 && (
            <div
              style={{ width: `${completedPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-500"
              title={`Completed: ${completed} (${completedPct.toFixed(1)}%)`}
            />
          )}
          {startedPct > 0 && (
            <div
              style={{ width: `${startedPct}%` }}
              className="h-full bg-amber-500 transition-all duration-500"
              title={`In Progress: ${started} (${startedPct.toFixed(1)}%)`}
            />
          )}
          {unstartedPct > 0 && (
            <div
              style={{ width: `${unstartedPct}%` }}
              className="h-full bg-blue-500 transition-all duration-500"
              title={`Unstarted: ${unstarted} (${unstartedPct.toFixed(1)}%)`}
            />
          )}
          {backlogPct > 0 && (
            <div
              style={{ width: `${backlogPct}%` }}
              className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-500"
              title={`Backlog: ${backlog} (${backlogPct.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legend / Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {/* Completed */}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium">Completed</span>
              <span className="text-sm font-bold text-foreground">
                {completed}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({completedPct.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>

          {/* In Progress / Started */}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
            <Clock className="size-4 text-amber-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium">Started</span>
              <span className="text-sm font-bold text-foreground">
                {started}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({startedPct.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Unstarted */}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
            <CircleDot className="size-4 text-blue-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium">Unstarted</span>
              <span className="text-sm font-bold text-foreground">
                {unstarted}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({unstartedPct.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Backlog */}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
            <Inbox className="size-4 text-slate-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium">Backlog</span>
              <span className="text-sm font-bold text-foreground">
                {backlog}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({backlogPct.toFixed(0)}%)
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue alert banner if > 0 */}
      {overdue > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <span>
              <strong>{overdue}</strong> {overdue === 1 ? 'work item is' : 'work items are'} past due date
            </span>
          </div>
          <Link
            href={`/projects/${projectId}/work-items`}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 shrink-0"
          >
            Review overdue
          </Link>
        </div>
      )}
    </div>
  );
}
