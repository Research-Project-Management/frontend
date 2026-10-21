'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';
import ProjectSettingsNavigationBar from '@/features/projects/project-id/settings/components/layout/NavigationBar';

export default function ProjectSettingLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';
  const { project } = useProjectDetails(projectId);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative flex-col">
      {/* Top Header: Project Switcher */}
      <header
        className="h-11 border-b border-border px-4 sm:px-6 flex items-center justify-between gap-3 bg-background shrink-0 select-none sticky top-0 z-10"
        style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
      >
        <Switcher
          project={{
            id: project?.id || projectId,
            name: project?.name || '',
            avatar: project?.avatar,
          }}
          moduleTitle="Settings"
          moduleIcon={Settings}
        />
      </header>

      {/* Tabs Navigation Bar (matching your-work style) */}
      <ProjectSettingsNavigationBar projectId={projectId} />

      {/* Subpage Content */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
