'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Button, Skeleton } from '@/shared/components/ui';
import { Loader2, ChevronRight } from 'lucide-react';
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
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Error loading cycle settings.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Cycles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure research sprint cycles and iteration preferences for this project.
          </p>
        </div>

        <Button
          size="sm"
          onClick={save}
          disabled={!hasChanges || isSaving}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-[#0070f3] hover:bg-[#0060df] text-white cursor-pointer shadow-2xs shrink-0"
        >
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Save changes
        </Button>
      </div>

      <div className="space-y-5">
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
        <div className="rounded-lg border border-border/80 bg-muted/20 px-6 py-4">
          <div className="flex gap-3 items-start">
            <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Active cycles are managed from the <strong className="text-foreground font-semibold">Cycles</strong> module inside your project. Settings here define the global defaults applied whenever a new cycle is created.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
