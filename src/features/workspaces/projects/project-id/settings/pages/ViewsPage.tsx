'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  SlidersHorizontal,
  Kanban,
  List,
  Table as TableIcon,
  Calendar,
  Clock,
  ExternalLink,
  Shield,
  Eye,
  Lock,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { useViewSettings } from '../hooks/use-view-settings';
import type { DefaultProjectViewLayout } from '../types/view.types';
import { cn } from "@/shared/lib/utils";

const LAYOUT_OPTIONS: Array<{
  id: DefaultProjectViewLayout;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'board',
    label: 'Board (Kanban)',
    description: 'Visual cards organized by state columns',
    icon: Kanban,
  },
  {
    id: 'list',
    label: 'List',
    description: 'Linear list view focused on fast triage',
    icon: List,
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Spreadsheet-like tabular grid with customizable columns',
    icon: TableIcon,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Monthly/weekly calendar mapped by target due date',
    icon: Calendar,
  },
  {
    id: 'timeline',
    label: 'Timeline (Gantt)',
    description: 'Roadmap scheduling with start and due date ranges',
    icon: Clock,
  },
];

export default function ViewsPage() {
  const { projectId } = useParams() as { projectId: string };
  const {
    defaultLayout,
    setDefaultLayout,
    allowPublicViews,
    setAllowPublicViews,
    showEmptyGroups,
    setShowEmptyGroups,
    lockedSystemViews,
    setLockedSystemViews,
    hasChanges,
    save,
    isSaving,
    isLoading,
  } = useViewSettings(projectId);

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-muted-foreground" />
            Views Configuration
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure default view presentation, layout preferences, and sharing permissions for this project.
          </p>
        </div>

        <Link
          href={`/projects/${projectId}/views`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <span>Manage Saved Views</span>
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* 1. Default Project View Layout */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Default Project Layout</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose the default layout displayed when members first open Work Items in this project.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LAYOUT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = defaultLayout === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDefaultLayout(opt.id)}
                className={cn(
                  "flex flex-col items-start p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:bg-muted/40 hover:border-border/80"
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <div
                    className={cn(
                      "p-1.5 rounded-md",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                <p className="text-11 text-muted-foreground mt-2 leading-relaxed">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. View Permissions & Sharing */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Permissions & Sharing</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control how views can be created, shared, and modified across the team.
          </p>
        </div>

        <div className="space-y-3">
          {/* Allow Public Views */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-background">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Allow Shared Team Views</span>
              </div>
              <p className="text-11 text-muted-foreground pl-6">
                Permit project members to publish views accessible by all project collaborators.
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowPublicViews}
              onChange={(e) => setAllowPublicViews(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
          </div>

          {/* Show Empty Groups */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-background">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Show Empty Columns by Default</span>
              </div>
              <p className="text-11 text-muted-foreground pl-6">
                Keep empty Kanban states and empty groups visible in views rather than collapsing them.
              </p>
            </div>
            <input
              type="checkbox"
              checked={showEmptyGroups}
              onChange={(e) => setShowEmptyGroups(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
          </div>

          {/* Lock System Views */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-background">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Lock System Views</span>
              </div>
              <p className="text-11 text-muted-foreground pl-6">
                Prevent project contributors from modifying or deleting project-wide default saved views.
              </p>
            </div>
            <input
              type="checkbox"
              checked={lockedSystemViews}
              onChange={(e) => setLockedSystemViews(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Save Action */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          onClick={save}
          disabled={!hasChanges || isSaving}
          size="sm"
          className="h-8 px-4 text-xs font-medium cursor-pointer shadow-xs"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
