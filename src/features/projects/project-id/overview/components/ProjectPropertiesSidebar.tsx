'use client';

import React from 'react';
import Link from 'next/link';
import { ProjectMetadata, ProjectState, ProjectPriority, ProjectStatusUpdate } from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Calendar,
  Users,
  Shield,
  Settings,
  AlertCircle,
  Clock,
  Flag,
  User,
  Activity,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ProjectPropertiesSidebarProps {
  project: ProjectMetadata;
  currentUpdate?: ProjectStatusUpdate | null;
}

const STATE_CONFIG: Record<
  ProjectState,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  planning: { label: 'Planning', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  execution: { label: 'In Execution', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  monitoring: { label: 'Monitoring', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
};

const PRIORITY_CONFIG: Record<
  ProjectPriority,
  { label: string; color: string }
> = {
  urgent: { label: 'Urgent', color: 'text-rose-600 dark:text-rose-400 font-semibold' },
  high: { label: 'High', color: 'text-amber-600 dark:text-amber-400 font-medium' },
  medium: { label: 'Medium', color: 'text-blue-600 dark:text-blue-400 font-medium' },
  low: { label: 'Low', color: 'text-slate-500 font-normal' },
  none: { label: 'None', color: 'text-muted-foreground' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function ProjectPropertiesSidebar({
  project,
  currentUpdate,
}: ProjectPropertiesSidebarProps) {
  const stateMeta = STATE_CONFIG[project.state] || {
    label: project.state,
    color: 'bg-muted text-muted-foreground',
  };
  const priorityMeta = PRIORITY_CONFIG[project.priority] || {
    label: project.priority,
    color: 'text-muted-foreground',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Project Details
        </h3>
        <Button asChild variant="ghost" size="icon" className="size-7 text-muted-foreground">
          <Link href={`/projects/${project.id}/settings`}>
            <Settings className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 text-xs">
        {/* State */}
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="size-3.5" /> State
          </span>
          <span
            className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${stateMeta.color}`}
          >
            {stateMeta.label}
          </span>
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Flag className="size-3.5" /> Priority
          </span>
          <span className={`capitalize text-xs ${priorityMeta.color}`}>
            {priorityMeta.label}
          </span>
        </div>

        {/* Health Status */}
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Activity className="size-3.5" /> Health
          </span>
          {currentUpdate ? (
            <span
              className={`px-2 py-0.5 rounded-md font-semibold text-[11px] capitalize ${
                currentUpdate.status === 'on_track'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : currentUpdate.status === 'at_risk'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {currentUpdate.status.replace('_', ' ')}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-[11px]">Not reported</span>
          )}
        </div>

        {/* Lead */}
        <div className="flex items-center justify-between py-1 border-b border-border/40">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Shield className="size-3.5" /> Project Lead
          </span>
          {project.lead ? (
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden">
                {project.lead.avatar ? (
                  <img
                    src={project.lead.avatar}
                    alt={project.lead.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-3" />
                )}
              </div>
              <span className="font-medium text-foreground truncate max-w-[120px]">
                {project.lead.name}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground italic">None</span>
          )}
        </div>

        {/* Timeline Dates */}
        <div className="flex flex-col gap-2 py-1 border-b border-border/40">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5" /> Timeline
          </span>
          <div className="grid grid-cols-2 gap-2 text-foreground">
            <div>
              <span className="text-[10px] text-muted-foreground block">Start Date</span>
              <span className="font-medium">{formatDate(project.startDate)}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Target Date</span>
              <span className="font-medium">{formatDate(project.targetDate)}</span>
            </div>
          </div>

          {project.daysRemaining !== null && (
            <div className="mt-1">
              <Badge
                variant={project.isOverdue ? 'destructive' : 'secondary'}
                className="text-[11px] font-medium"
              >
                {project.isOverdue ? (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="size-3" /> Overdue by{' '}
                    {Math.abs(project.daysRemaining)} days
                  </span>
                ) : project.daysRemaining === 0 ? (
                  'Due today'
                ) : (
                  `${project.daysRemaining} days remaining`
                )}
              </Badge>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Users className="size-3.5" /> Members ({project.totalMembers})
            </span>
            <Link
              href={`/projects/${project.id}/settings/members`}
              className="text-[11px] text-primary hover:underline"
            >
              Manage
            </Link>
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            {(project.members || []).slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <User className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-medium text-foreground truncate">
                    {m.name}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                  {m.role}
                </span>
              </div>
            ))}
            {(project.totalMembers || 0) > 5 && (
              <span className="text-[11px] text-muted-foreground mt-1">
                +{(project.totalMembers || 0) - 5} more members
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
