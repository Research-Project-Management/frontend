'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, useLibrarySidebarStore } from "@/features/workspaces/library";
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/reader/');
  const { isOpen } = useLibrarySidebarStore();

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      {!isReader && isOpen && (
        <aside className="shrink-0 relative z-20">
          <Sidebar />
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main className={`flex-1 min-h-0 relative ${isReader ? "flex flex-col" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
