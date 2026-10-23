import React, { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  Users,
  User,
  Activity,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import type {
  ProjectOverviewData,
  ProjectStatusIndicator,
} from '../types/overview.types';
import { AddStatusUpdateModal } from './AddStatusUpdateModal';
import { useCreateProjectStatusUpdate } from '../hooks/use-project-overview';

export interface CleanProjectOverviewProps {
  data: ProjectOverviewData;
}

const STATUS_CONFIG: Record<
  ProjectStatusIndicator,
  {
    label: string;
    badgeClass: string;
    icon: React.ElementType;
    indicatorDot: string;
  }
> = {
  on_track: {
    label: 'On Track',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
    indicatorDot: 'bg-emerald-500',
  },
  at_risk: {
    label: 'At Risk',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: AlertCircle,
    indicatorDot: 'bg-amber-500',
  },
  off_track: {
    label: 'Off Track',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    icon: AlertCircle,
    indicatorDot: 'bg-rose-500',
  },
};

function formatDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function CleanProjectOverview({ data }: CleanProjectOverviewProps) {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const { project, metrics, recentActivities, currentUpdate } = data;
  const createUpdateMutation = useCreateProjectStatusUpdate(project.id);

  const totalWorkItems =
    metrics?.totalWorkItems ??
    (metrics as { totalIssues?: number })?.totalIssues ??
    0;
  const completed = metrics?.completed || 0;
  const inProgress = metrics?.started || 0;
  const completionPercentage = metrics?.completionPercentage || 0;

  const statusConfig = currentUpdate
    ? STATUS_CONFIG[currentUpdate.status] || null
    : null;

  const membersList = project.members || [];
  const displayMembers = membersList.slice(0, 6);
  const formattedTargetDate = formatDate(project.targetDate);

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 py-2 px-1">
      {/* 1. MINIMAL HERO / PROJECT IDENTIFIER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-11 rounded-lg border border-border bg-muted/40 flex items-center justify-center text-foreground font-semibold text-lg select-none shrink-0 overflow-hidden shadow-2xs">
            {project.avatar ? (
              <span className="text-xl">{project.avatar}</span>
            ) : (
              <FolderKanban className="size-5 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-18 font-semibold tracking-tight text-foreground truncate">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-11 font-mono font-medium text-muted-foreground bg-muted/30 border-border/80"
              >
                {project.identifier}
              </Badge>
            </div>
            {project.description ? (
              <p className="text-13 text-muted-foreground truncate max-w-xl mt-0.5">
                {project.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. CORE STATS BAR (Streamlined KPIs with clean fallbacks) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
        {/* Work items */}
        <div className="flex flex-col p-3 rounded-lg bg-muted/20 border border-border/40">
          <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-muted-foreground/70" />
            Work Items
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-20 font-semibold font-mono text-foreground">
              {totalWorkItems}
            </span>
            {totalWorkItems > 0 ? (
              <span className="text-12 text-muted-foreground font-mono">
                ({completed} done)
              </span>
            ) : (
              <span className="text-12 text-muted-foreground font-sans">
                No items
              </span>
            )}
          </div>
        </div>

        {/* Progress % */}
        <div className="flex flex-col p-3 rounded-lg bg-muted/20 border border-border/40">
          <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-muted-foreground/70" />
            Progress
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-20 font-semibold font-mono text-foreground">
              {completionPercentage}%
            </span>
            {inProgress > 0 ? (
              <span className="text-12 text-muted-foreground font-mono">
                {inProgress} active
              </span>
            ) : null}
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col p-3 rounded-lg bg-muted/20 border border-border/40 justify-between">
          <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
            <Activity className="size-3.5 text-muted-foreground/70" />
            Status
          </span>
          <div className="mt-1 flex items-center justify-between gap-1">
            {statusConfig ? (
              <Badge
                variant="outline"
                className={`h-5 px-2 text-11 font-medium gap-1.5 ${statusConfig.badgeClass}`}
              >
                <span className={`size-1.5 rounded-full ${statusConfig.indicatorDot}`} />
                <span>{statusConfig.label}</span>
              </Badge>
            ) : (
              <span className="text-13 text-muted-foreground font-mono">—</span>
            )}
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="text-11 text-primary hover:underline font-medium cursor-pointer"
            >
              Update
            </button>
          </div>
        </div>

        {/* Target Date */}
        <div className="flex flex-col p-3 rounded-lg bg-muted/20 border border-border/40">
          <span className="text-12 font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground/70" />
            Target Date
          </span>
          <div className="mt-1 flex items-baseline">
            {formattedTargetDate ? (
              <span className="text-13 font-medium text-foreground font-mono truncate">
                {formattedTargetDate}
              </span>
            ) : (
              <span className="text-13 text-muted-foreground font-mono">—</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. TWO-COLUMN BALANCED CONTENT (Activities & Members) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
        {/* Left: Recent Activity Stream (8 cols) */}
        <div className="md:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-13 font-semibold text-foreground flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <Link
              href={`/projects/${project.id}/work-items`}
              className="text-12 text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-lg border border-dashed border-border/70 bg-muted/10 text-12 text-muted-foreground">
              No recent activity recorded yet.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60 bg-card overflow-hidden">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 sm:px-4 flex items-start gap-3 hover:bg-muted/30 transition-colors text-12"
                >
                  <div className="size-6 rounded-full bg-muted border border-border/80 flex items-center justify-center text-muted-foreground overflow-hidden shrink-0 mt-0.5">
                    {act.actor?.avatar ? (
                      <img
                        src={act.actor.avatar}
                        alt={act.actor.name || 'User'}
                        className="size-full object-cover"
                      />
                    ) : (
                      <User className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {act.actor?.name || 'Someone'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {act.verb?.replace(/_/g, ' ') || 'updated'}
                    </span>
                    {act.field && (
                      <span className="text-muted-foreground"> {act.field}</span>
                    )}
                  </div>
                  <span className="text-11 text-muted-foreground/70 font-mono shrink-0">
                    {formatRelativeTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Team (4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-13 font-semibold text-foreground flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                Team ({membersList.length})
              </h2>
              <Link
                href={`/projects/${project.id}/settings/members`}
                className="text-12 text-muted-foreground hover:text-foreground hover:underline"
              >
                Manage
              </Link>
            </div>

            {displayMembers.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-lg border border-dashed border-border/70 bg-muted/10 text-12 text-muted-foreground">
                No members assigned
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60 bg-card overflow-hidden">
                {displayMembers.map((member) => (
                  <div
                    key={member.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-12"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-full bg-muted border border-border/80 flex items-center justify-center overflow-hidden shrink-0">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <User className="size-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground truncate">
                        {member.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 text-11 font-medium uppercase tracking-wider text-muted-foreground border-border/80"
                    >
                      {member.role || 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      <AddStatusUpdateModal
        open={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
        onSubmit={async (data) => {
          await createUpdateMutation.mutateAsync(data);
          setIsStatusModalOpen(false);
        }}
      />
    </div>
  );
}

export default CleanProjectOverview;
