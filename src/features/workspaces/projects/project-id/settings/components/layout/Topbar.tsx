'use client';

import React from 'react';
import { Settings } from 'lucide-react';

interface TopbarProps {
  project?: {
    name: string;
    avatar?: string;
  };
  centerContent?: React.ReactNode;
}

export function Topbar({ project, centerContent }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background sticky top-0 z-50 shrink-0"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-3">
        <Settings className="size-4 text-foreground" />
        <h1 className="text-sm font-semibold text-foreground">
          {project?.name ? `${project.name} · Settings` : 'Settings'}
        </h1>
      </div>

      {centerContent && (
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10">
          <div className="pointer-events-auto flex items-center h-full">
            {centerContent}
          </div>
        </div>
      )}

      <div className="w-10" />
    </header>
  );
}

export default Topbar;
