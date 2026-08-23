'use client';

import React from 'react';
import NavigationBar from '@/features/workspaces/projects/project-id/storage/components/layout/NavigationBar';
import Preview from '@/features/workspaces/projects/project-id/storage/components/preview/Preview';

export default function ProjectStorageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <NavigationBar />
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
        <Preview />
      </div>
    </div>
  );
}

