'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, useLibrarySidebarStore } from '@/features/library';
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
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {isOpen && <Sidebar />}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
