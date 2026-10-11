'use client';

import { usePathname } from 'next/navigation';
import { LibrarySidebar as Sidebar } from '@/features/library/components/sidebar/LibrarySidebar';
import { useLibrarySidebarStore } from '@/features/library/store/library-ui.store';
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/library/papers/');
  const isSidebarOpen = useLibrarySidebarStore((s) => s.isSidebarOpen);

  if (isReader) {
    return (
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
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
    </div>
  );
}
