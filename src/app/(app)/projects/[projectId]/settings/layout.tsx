'use client';

import React from 'react';
import Sidebar from '@/features/workspaces/projects/project-id/settings/components/layout/Sidebar';

export default function ProjectSettingLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
