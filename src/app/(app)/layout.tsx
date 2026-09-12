'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import React, { Suspense } from 'react';

const Topbar = dynamic(
  () => import('@/features/workspaces/shell/components/Topbar'),
  { ssr: true, loading: () => null }
);

const Sidebar = dynamic(
  () => import('@/features/workspaces/shell/components/Sidebar'),
  { ssr: true, loading: () => null }
);

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPaperReader = pathname.includes('/library/papers/');

  if (isPaperReader) {
    return (
      <div className='h-dvh w-full overflow-hidden bg-background'>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>
    );
  }

  return (
    <div className='h-dvh flex flex-col overflow-clip bg-muted'>
      <Suspense fallback={null}>
        <Topbar />
      </Suspense>
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row'>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <div className='order-1 flex-1 min-w-0 rounded-md border border-border bg-background overflow-hidden md:order-2 flex flex-col relative'>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
