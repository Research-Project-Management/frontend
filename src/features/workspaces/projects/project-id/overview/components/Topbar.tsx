'use client';

import React from 'react';
import { ChartBarBig } from 'lucide-react';
import type { ProjectInfo } from '../types/overview.types';

interface TopbarProps {
  project?: Pick<ProjectInfo, 'name' | 'avatar'>;
}

export function Topbar({ project }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <ChartBarBig className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          {project?.name ? `${project.name} · Overview` : 'Overview'}
        </h1>
      </div>
    </header>
  );
}

export default Topbar;
