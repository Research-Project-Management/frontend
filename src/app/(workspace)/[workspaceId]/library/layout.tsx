'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/features/workspaces/library/components/sidebar/Sidebar';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/library/papers/');
  const { isOpen } = useLibrarySidebarStore();

  if (isReader) {
    return (
      <div className="flex h-full w-full bg-background overflow-hidden relative">
        <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative select-none">
      {isOpen && <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
