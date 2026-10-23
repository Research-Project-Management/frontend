'use client';

import { usePathname } from 'next/navigation';
import { LibrarySidebar as Sidebar } from '@/features/library/ui/sidebar/LibrarySidebar';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { LibraryModals } from '@/features/library/ui/modals/LibraryModals';
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/library/papers/');
  const isSidebarOpen = useLibraryUIStore((s) => s.isSidebarOpen);

  if (isReader) {
    return (
      <main className="h-full w-full flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {isSidebarOpen && <Sidebar />}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
      <LibraryModals />
    </div>
  );
}
