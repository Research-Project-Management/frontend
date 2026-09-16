'use client';

import React, { useState } from 'react';
import { ProjectMetadata } from '../types/overview.types';
import { Badge } from '@/shared/components/ui/badge';
import { ChevronDown, ChevronUp, FolderKanban } from 'lucide-react';

interface ProjectHeaderCardProps {
  project: ProjectMetadata;
}

export function ProjectHeaderCard({ project }: ProjectHeaderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const description = project.description?.trim();
  const isLongDescription = description && description.length > 200;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Cover / Gradient Header */}
      <div
        className="h-28 sm:h-36 w-full bg-gradient-to-r from-primary/10 via-primary/5 to-muted border-b border-border/40 relative"
        style={
          project.coverImage
            ? {
                backgroundImage: `url(${project.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>

      {/* Main Info */}
      <div className="px-5 pb-5 pt-0 -mt-10 sm:-mt-12 relative flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          {/* Avatar Icon */}
          <div className="size-16 sm:size-20 rounded-xl border-4 border-card bg-muted flex items-center justify-center text-primary shadow-sm font-semibold text-xl sm:text-2xl select-none shrink-0 overflow-hidden">
            {project.avatar ? (
              <img
                src={project.avatar}
                alt={project.name}
                className="size-full object-cover"
              />
            ) : (
              <FolderKanban className="size-8 sm:size-10 text-primary" />
            )}
          </div>

          {/* Identifier Badge */}
          <div className="pb-1">
            <Badge
              variant="outline"
              className="text-xs font-mono font-semibold tracking-wider uppercase px-2.5 py-1 bg-muted/60 text-muted-foreground border-border"
            >
              {project.identifier}
            </Badge>
          </div>
        </div>

        {/* Title and Charter/Description */}
        <div className="flex flex-col gap-1.5 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {project.name}
          </h1>

          {description ? (
            <div className="text-sm text-muted-foreground leading-relaxed">
              <p className={!isExpanded && isLongDescription ? 'line-clamp-2' : ''}>
                {description}
              </p>
              {isLongDescription && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="size-3" />
                    </>
                  ) : (
                    <>
                      Read charter <ChevronDown className="size-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No description or project charter provided yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
