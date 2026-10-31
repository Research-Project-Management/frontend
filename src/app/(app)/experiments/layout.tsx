'use client';

import React from 'react';
import { ExperimentsSidebar } from '@/features/experiments/components/ExperimentsSidebar';
import { useExperimentsUIStore } from '@/features/experiments/store/experiments-ui.store';

export default function ExperimentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSidebarOpen = useExperimentsUIStore((s) => s.isSidebarOpen);

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {isSidebarOpen && <ExperimentsSidebar />}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
