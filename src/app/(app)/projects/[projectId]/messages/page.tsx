'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { useProject } from '@/features/projects/shell/hooks/use-project';

export default function MessagesRoute() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';
  const { state: projectState } = useProject(projectId);
  const project = projectState?.project;

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      {/* Top Header with Switcher */}
      <header className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 bg-background shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-10">
        <Switcher
          project={{
            id: project?.id || projectId,
            name: project?.name || '',
            avatar: project?.avatar,
          }}
          moduleTitle="Messages"
          moduleIcon={MessageSquare}
        />
      </header>

      {/* Mock Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="size-12 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 border border-border/50">
          <MessageSquare className="size-6 text-foreground/70" strokeWidth={1.5} />
        </div>
        <h2 className="text-16 font-semibold text-foreground tracking-tight">
          Realtime Messages
        </h2>
        <p className="text-13 text-muted-foreground max-w-sm mt-1">
          Team communication and live channels for this project.
        </p>
      </div>
    </div>
  );
}
