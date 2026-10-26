'use client';

import React from 'react';
import Link from 'next/link';
import {
  ProjectMetadata,
  ProjectStatusUpdate,
} from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Calendar,
  Users,
  Settings,
  Clock,
  Flag,
  User,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ProjectPropertiesSidebarProps {
  project: ProjectMetadata;
  currentUpdate?: ProjectStatusUpdate | null;
}

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  urgent: { label: 'Urgent', color: 'text-rose-500', dotColor: 'bg-rose-500' },
  high: { label: 'High', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  medium: { label: 'Medium', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  low: { label: 'Low', color: 'text-muted-foreground', dotColor: 'bg-muted-foreground' },
  none: { label: 'None', color: 'text-muted-foreground/60', dotColor: 'bg-muted-foreground/40' },
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
}: ProjectPropertiesSidebarProps) {
  // Directly bind state info returned from DB via project.state
  const stateName =
    typeof project.state === 'object' && project.state !== null
      ? project.state.name
      : typeof project.state === 'string'
        ? project.state
        : null;

  const stateColor =
    typeof project.state === 'object' && project.state !== null && project.state.color
      ? project.state.color
      : null;

  const priorityMeta = PRIORITY_CONFIG[project.priority] || {
    label: project.priority || 'None',
    color: 'text-foreground',
    dotColor: 'bg-muted-foreground',
  };

  const membersList = project.members || [];
  const displayMembers = membersList.slice(0, 5);
  const totalMembers = project.totalMembers ?? membersList.length;
  const remainingCount = Math.max(0, totalMembers - displayMembers.length);

  return (
    <div className="flex flex-col gap-4">
      {/* Properties Inspector Card - Bound directly to database */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-4 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-13 font-semibold tracking-tight text-foreground">
            Project Properties
          </h3>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Edit settings"
          >
            <Link href={`/projects/${project.id}/settings`}>
              <Settings className="size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Key-Value Properties Rows from DB */}
        <div className="flex flex-col gap-3 text-12">
          {/* State */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Clock className="size-3.5" /> State
            </span>
            {stateName ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-11 font-medium bg-muted/60 text-foreground border border-border/70">
                {stateColor && (
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: stateColor }}
                  />
                )}
                <span>{stateName}</span>
              </div>
            ) : (
              <span className="text-muted-foreground italic text-11">Unassigned</span>
            )}
          </div>

          {/* Priority */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Flag className="size-3.5" /> Priority
            </span>
            <div className="inline-flex items-center gap-1.5 text-12 font-medium capitalize">
              <span className={`size-1.5 rounded-full ${priorityMeta.dotColor}`} />
              <span className={priorityMeta.color}>{priorityMeta.label}</span>
            </div>
          </div>

          {/* Project Lead */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <User className="size-3.5" /> Project Lead
            </span>
            {project.lead ? (
              <div className="flex items-center gap-1.5">
                <div className="size-5 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {project.lead.avatar ? (
                    <img
                      src={project.lead.avatar}
                      alt={project.lead.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-3 text-muted-foreground" />
                  )}
                </div>
                <span className="font-medium text-foreground text-12">
                  {project.lead.name}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground italic text-11">Unassigned</span>
            )}
          </div>

          {/* Start Date */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Start Date
            </span>
            <span className="text-foreground font-medium font-mono text-11">
              {formatDate(project.startDate)}
            </span>
          </div>

          {/* Target Date */}
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Target Date
            </span>
            <span
              className={`font-medium font-mono text-11 ${
                project.isOverdue
                  ? 'text-rose-500 font-semibold'
                  : 'text-foreground'
              }`}
            >
              {formatDate(project.targetDate)}
              {project.isOverdue && (
                <span className="ml-1 text-11 uppercase tracking-wider font-sans font-semibold">
                  (Overdue)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Team Members Card - Bound to DB project_members */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-3.5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <h3 className="text-13 font-semibold tracking-tight text-foreground">
              Team Members
            </h3>
            <span className="text-11 text-muted-foreground font-mono">
              ({totalMembers})
            </span>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Link href={`/projects/${project.id}/settings?tab=members`}>
              Manage
            </Link>
          </Button>
        </div>

        {displayMembers.length > 0 ? (
          <div className="flex flex-col divide-y divide-border/40">
            {displayMembers.map((member) => (
              <div
                key={member.id}
                className="py-2 flex items-center justify-between gap-2 text-12 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
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
                  className="h-5 px-2 text-11 font-medium uppercase tracking-wider text-muted-foreground border-border/80"
                >
                  {member.role || 'Member'}
                </Badge>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="pt-2 text-11 text-muted-foreground text-center">
                + {remainingCount} more members
              </div>
            )}
          </div>
        ) : (
          <div className="text-12 text-muted-foreground italic py-1">
            No additional members added yet.
          </div>
        )}
      </div>

      {/* Quick Links Card */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2.5 transition-colors">
        <span className="text-11 font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Access
        </span>
        <div className="flex flex-col gap-1 text-12">
          <Link
            href={`/projects/${project.id}/work-items`}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-foreground transition-colors"
          >
            <span>All Work Items</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </Link>
          <Link
            href={`/projects/${project.id}/pages`}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-foreground transition-colors"
          >
            <span>Project Documents & Pages</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </Link>
          <Link
            href={`/projects/${project.id}/settings`}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-foreground transition-colors"
          >
            <span>General Settings</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
