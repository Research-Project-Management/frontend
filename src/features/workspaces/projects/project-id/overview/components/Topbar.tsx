'use client';

import React from 'react';
import { ChartBarBig } from 'lucide-react';
import type { ProjectInfo } from '../types/overview.types';
import { ProjectTopbarSwitcher } from '@/features/workspaces/projects/project-id/components/layout';

interface TopbarProps {
  project?: Pick<ProjectInfo, 'name' | 'avatar'>;
}

export function Topbar({ project }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <ProjectTopbarSwitcher
        project={project}
        moduleTitle="Overview"
        moduleIcon={ChartBarBig}
      />
    </header>
  );
}

export default Topbar;
