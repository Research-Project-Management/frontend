'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProjectMetadata } from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  FolderKanban,
  Settings,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ProjectHeaderCardProps {
  project: ProjectMetadata;
  totalWorkItems?: number;
  completedWorkItems?: number;
  completionPercentage?: number;
  onPostUpdate?: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function ProjectHeaderCard({
  project,
  totalWorkItems = 0,
  completedWorkItems = 0,
  completionPercentage = 0,
  onPostUpdate,
}: ProjectHeaderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const description = project.description?.trim();
  const isLongDescription = Boolean(description && description.length > 220);

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

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden transition-colors">
      {/* Subtle Cover Banner from DB */}
      {project.coverImage ? (
        <div
          className="h-28 sm:h-36 w-full bg-cover bg-center border-b border-border/60 relative"
          style={{ backgroundImage: `url(${project.coverImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-card/85 via-card/40 to-transparent" />
        </div>
      ) : (
        <div className="h-10 sm:h-12 w-full bg-gradient-to-r from-muted/60 via-muted/30 to-muted/10 border-b border-border/40" />
      )}

      {/* Main Header Content */}
      <div className={`p-4 sm:p-5 ${project.coverImage ? '-mt-10 sm:-mt-12 relative' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left: Avatar & Basic Information from DB */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="size-12 sm:size-14 rounded-lg border border-border/80 bg-background shadow-xs flex items-center justify-center text-foreground font-semibold text-xl select-none shrink-0 overflow-hidden">
              {project.avatar ? (
                <img
                  src={project.avatar}
                  alt={project.name}
                  className="size-full object-cover"
                />
              ) : (
                <FolderKanban className="size-6 text-foreground/80" />
              )}
            </div>

            <div className="flex flex-col min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-16 sm:text-18 font-semibold tracking-tight text-foreground truncate">
                  {project.name}
                </h1>
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-11 font-mono font-medium bg-muted/50 text-foreground/80 border-border"
                >
                  {project.identifier}
                </Badge>
                {stateName && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-11 font-medium bg-muted/60 text-foreground border border-border">
                    {stateColor && (
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: stateColor }}
                      />
                    )}
                    <span>{stateName}</span>
                  </div>
                )}
              </div>

              {/* Quick Meta Row from DB */}
              <div className="flex items-center gap-3 mt-1.5 text-12 text-muted-foreground flex-wrap">
                {project.targetDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 shrink-0" />
                    <span>Target: {formatDate(project.targetDate)}</span>
                  </span>
                )}
                {project.lead && (
                  <span className="flex items-center gap-1">
                    <span className="text-foreground/60 font-medium">Lead:</span>
                    <span className="text-foreground">{project.lead.name}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="size-3.5 shrink-0" />
                  <span>{project.totalMembers || project.members?.length || 0} members</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {onPostUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPostUpdate}
                className="h-8 px-2.5 text-12 font-medium border-border hover:bg-muted text-foreground cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Clock className="size-3.5 mr-1.5 text-muted-foreground" />
                <span>Post Update</span>
              </Button>
            )}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-12 font-medium hover:bg-muted text-foreground cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Link href={`/projects/${project.id}/settings`}>
                <Settings className="size-3.5 mr-1.5 text-muted-foreground" />
                <span>Settings</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Project Description from DB */}
        {description ? (
          <div className="mt-3.5 pt-3 border-t border-border/50 text-13 text-muted-foreground leading-relaxed">
            <p className={!isExpanded && isLongDescription ? 'line-clamp-2' : ''}>
              {description}
            </p>
            {isLongDescription && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-1.5 inline-flex items-center gap-1 text-12 font-medium text-foreground hover:underline cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {isExpanded ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="size-3" />
                  </>
                ) : (
                  <>
                    <span>Show more</span>
                    <ChevronDown className="size-3" />
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3.5 pt-3 border-t border-border/50 text-12 text-muted-foreground italic flex items-center justify-between">
            <span>No description provided for this project.</span>
            <Link
              href={`/projects/${project.id}/settings`}
              className="text-foreground font-medium hover:underline text-12 not-italic"
            >
              Add description
            </Link>
          </div>
        )}

        {/* Mini KPI Bar from DB aggregated metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted/30">
            <Layers className="size-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-12 text-muted-foreground font-medium">Work Items</span>
              <span className="text-13 font-semibold text-foreground font-mono">{totalWorkItems}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted/30">
            <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-12 text-muted-foreground font-medium">Completed</span>
              <span className="text-13 font-semibold text-foreground font-mono">
                {completedWorkItems}{' '}
                <span className="text-12 font-normal text-muted-foreground">
                  ({completionPercentage}%)
                </span>
              </span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted/30">
            <Clock className="size-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-12 text-muted-foreground font-medium">Target Date</span>
              <span className="text-13 font-semibold text-foreground font-mono truncate">
                {formatDate(project.targetDate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
