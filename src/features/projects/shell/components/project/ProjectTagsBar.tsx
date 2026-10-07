'use client';

import React from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Project } from '../../types/project.types';
import type { ProjectLabel } from '../../services/project-label.service';

export interface ProjectTagsBarProps {
  labels: ProjectLabel[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  projects: Project[];
  onNewTagClick: () => void;
}

export function ProjectTagsBar({
  labels,
  selectedTagId,
  onSelectTag,
  projects,
  onNewTagClick,
}: ProjectTagsBarProps) {
  // Calculate count of projects tagged with each label
  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      if (p.projectLabelsList && Array.isArray(p.projectLabelsList)) {
        for (const l of p.projectLabelsList) {
          counts[l.id] = (counts[l.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [projects]);

  if (labels.length === 0) {
    return (
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border/60 bg-muted/40 text-12 text-muted-foreground select-none">
        <Tag className="size-3 shrink-0 text-muted-foreground" />
        <span>Organize your manuscripts with tags & folders:</span>
        <button
          type="button"
          onClick={onNewTagClick}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-12 font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20 relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="size-3" />
          <span>New Tag</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-6 py-2 border-b border-border/60 bg-muted/30 select-none overflow-x-auto min-w-0"
      style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
    >
      <div className="flex items-center gap-1 text-12 font-medium text-muted-foreground mr-1 shrink-0">
        <Tag className="size-3 shrink-0" />
        <span className="hidden sm:inline">Tags:</span>
      </div>

      {/* "All" pill */}
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-12 font-medium transition-colors cursor-pointer shrink-0 border relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          selectedTagId === null
            ? 'bg-background text-foreground border-border font-medium'
            : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
        )}
      >
        <span>All</span>
        <span className="text-11 font-mono tabular-nums opacity-70">
          {projects.length}
        </span>
      </button>

      {/* Tag pills */}
      {labels.map((label) => {
        const isSelected = selectedTagId === label.id;
        const count = tagCounts[label.id] || 0;

        return (
          <button
            key={label.id}
            type="button"
            onClick={() => onSelectTag(isSelected ? null : label.id)}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-12 font-medium transition-all cursor-pointer shrink-0 border relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isSelected
                ? 'bg-background text-foreground border-border font-medium ring-1'
                : 'bg-transparent text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground hover:border-border'
            )}
            style={
              isSelected
                ? { borderColor: label.color, boxShadow: `0 0 0 1px ${label.color}` }
                : undefined
            }
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: label.color }}
            />
            <span>{label.name}</span>
            <span className="text-11 font-mono tabular-nums opacity-60">
              {count}
            </span>
            {isSelected && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag(null);
                }}
                className="ml-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear filter"
              >
                <X className="size-3" />
              </span>
            )}
          </button>
        );
      })}

      {/* Add New Tag button */}
      <button
        type="button"
        onClick={onNewTagClick}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 border border-dashed border-border relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="Create new tag"
      >
        <Plus className="size-3" />
        <span>New Tag</span>
      </button>
    </div>
  );
}
