'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { ChevronRight } from 'lucide-react';
import { CycleIcon } from "@/shared/components/ui";
import TopBar from '../components/layout/TopBar';
import { Duration } from '../components/cycle/Duration';
import { Automation } from '../components/cycle/Automation';
import { useCycleSettings } from '../hooks/use-cycle-settings';

export default function CyclePage() {
  const { projectId } = useParams() as { projectId: string };
  const {
    project,
    duration,
    setDuration,
    autoAdvance,
    setAutoAdvance,
    hasChanges,
    save,
    isSaving,
    isLoading,
    isError,
  } = useCycleSettings(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Cycles"
          Icon={CycleIcon}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Cycles"
          Icon={CycleIcon}
        />
        <div className="flex-1 p-5 md:p-6 text-sm text-muted-foreground">
          Error loading cycle settings.
        </div>
      </div>
    );
  }

  const topBarActions = (
    <Button
      size="sm"
      onClick={save}
      disabled={!hasChanges || isSaving}
      className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none shrink-0"
    >
      Save changes
    </Button>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <TopBar
        title="Cycles"
        Icon={CycleIcon}
        actions={topBarActions}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
          <div className="space-y-4">
            {/* Default Duration */}
            <Duration
              value={duration}
              onChange={setDuration}
              disabled={isSaving}
            />

            {/* Cycle Automation */}
            <Automation
              autoAdvance={autoAdvance}
              onToggle={setAutoAdvance}
              disabled={isSaving}
            />

            {/* Info Callout */}
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex gap-3 items-start">
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Active cycles are managed from the <strong className="text-foreground font-semibold">Cycles</strong> module inside your project. Settings here define the global defaults applied whenever a new cycle is created.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
