'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import React from 'react';

const WorkspaceTopbar = dynamic(
  () => import('@/features/workspaces/shell/components/Topbar'),
  { ssr: true, loading: () => null }
);

const WorkspaceSidebar = dynamic(
  () => import('@/features/workspaces/shell/components/Sidebar'),
  { ssr: true, loading: () => null }
);

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPaperReader = pathname.includes('/library/papers/');

  if (isPaperReader) {
    return (
      <div className='h-dvh w-full overflow-hidden bg-background'>
        {children}
      </div>
    );
  }

  return (
    <div className='h-dvh flex flex-col overflow-clip bg-[oklch(0.9543_0.001_230.67)] dark:bg-[oklch(0.1932_0.002_230.81)]'>
      <WorkspaceTopbar />
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row'>
        <WorkspaceSidebar />
        <div className='order-1 flex-1 min-w-0 p-1 rounded-lg border border-border/50 bg-background shadow-2xs md:order-2'>
          {children}
        </div>
      </div>
    </div>
  );
}
