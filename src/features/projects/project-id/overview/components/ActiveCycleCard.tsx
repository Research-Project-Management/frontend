'use client';

import React from 'react';
import Link from 'next/link';
import { ActiveCycleSummary } from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Repeat, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ActiveCycleCardProps {
  projectId: string;
  activeCycle: ActiveCycleSummary | null;
}

function formatDateSafe(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function ActiveCycleCard({
  projectId,
  activeCycle,
}: ActiveCycleCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Current Active Cycle
          </h2>
        </div>

        <Link
          href={`/projects/${projectId}/cycles`}
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
        >
          All cycles <ArrowRight className="size-3" />
        </Link>
      </div>

      {!activeCycle ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-lg border border-dashed border-border/70 bg-muted/20">
          <Repeat className="size-8 text-muted-foreground/40 mb-1.5" />
          <p className="text-xs font-medium text-foreground">No active sprint cycle</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
            There is currently no cycle running in this project.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-2.5 h-7 text-xs text-primary">
            <Link href={`/projects/${projectId}/cycles`}>
              Go to Cycles
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-background/50 p-3.5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                href={`/projects/${projectId}/cycles/${activeCycle.id}`}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
              >
                {activeCycle.name}
                <ArrowRight className="size-3 text-muted-foreground" />
              </Link>

              {(activeCycle.startDate || activeCycle.endDate) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>
                    {formatDateSafe(activeCycle.startDate)} — {formatDateSafe(activeCycle.endDate)}
                  </span>
                </div>
              )}
            </div>

            {activeCycle.daysRemaining !== null && (
              <Badge
                variant={activeCycle.daysRemaining < 0 ? 'destructive' : 'secondary'}
                className="text-xs shrink-0"
              >
                {activeCycle.daysRemaining < 0
                  ? 'Overdue'
                  : activeCycle.daysRemaining === 0
                    ? 'Ends today'
                    : `${activeCycle.daysRemaining} days left`}
              </Badge>
            )}
          </div>

          {/* Progress */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-500" />
                {activeCycle.completedIssues} of {activeCycle.totalIssues} completed
              </span>
              <span className="font-semibold text-foreground">
                {activeCycle.completionPercentage}%
              </span>
            </div>
            <Progress value={activeCycle.completionPercentage} className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}
