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
  Loader2,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import TopBar from '../components/layout/TopBar';
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
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Views"
          description="Configure default layouts, view presentation, and permissions"
          Icon={SlidersHorizontal}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const topBarActions = (
    <div className="flex items-center gap-2">
      <Link
        href={`/projects/${projectId}/views`}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-foreground hover:bg-muted border border-border rounded-md transition-colors"
      >
        <span>Manage views</span>
        <ExternalLink className="size-3.5 text-muted-foreground" />
      </Link>

      <Button
        type="button"
        onClick={save}
        disabled={!hasChanges || isSaving}
        size="sm"
        className="h-8 px-3.5 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none shrink-0"
      >
        {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin shrink-0" />}
        Save changes
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <TopBar
        title="Views"
        description="Configure default layouts, view presentation, and permissions"
        Icon={SlidersHorizontal}
        actions={topBarActions}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
          {/* 1. Default Project View Layout */}
          <div className="space-y-3">
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
                      "flex flex-col items-start p-3.5 rounded-md border text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/50"
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
          <div className="space-y-3 pt-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Permissions & Sharing</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Control how views can be created, shared, and modified across the team.
              </p>
            </div>

            <div className="rounded-md border border-border bg-card divide-y divide-border/60">
              {/* Allow Public Views */}
              <div className="flex items-center justify-between p-4">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground">Allow Shared Team Views</span>
                  </div>
                  <p className="text-11 text-muted-foreground pl-6">
                    Permit project members to publish views accessible by all project collaborators.
                  </p>
                </div>
                <Switch
                  checked={allowPublicViews}
                  onCheckedChange={setAllowPublicViews}
                />
              </div>

              {/* Show Empty Groups */}
              <div className="flex items-center justify-between p-4">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground">Show Empty Columns by Default</span>
                  </div>
                  <p className="text-11 text-muted-foreground pl-6">
                    Keep empty Kanban states and empty groups visible in views rather than collapsing them.
                  </p>
                </div>
                <Switch
                  checked={showEmptyGroups}
                  onCheckedChange={setShowEmptyGroups}
                />
              </div>

              {/* Lock System Views */}
              <div className="flex items-center justify-between p-4">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground">Lock System Views</span>
                  </div>
                  <p className="text-11 text-muted-foreground pl-6">
                    Prevent project contributors from modifying or deleting project-wide default saved views.
                  </p>
                </div>
                <Switch
                  checked={lockedSystemViews}
                  onCheckedChange={setLockedSystemViews}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
