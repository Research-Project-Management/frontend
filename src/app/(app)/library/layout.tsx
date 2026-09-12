'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/features/workspaces/library/components/Sidebar';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import { TooltipProvider } from "@/shared/components/ui";
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/library/papers/');
  const { isOpen } = useLibrarySidebarStore();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full flex-col bg-background overflow-hidden relative select-none">
        {isReader ? (
          <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            {children}
          </main>
        ) : (
          <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
            {isOpen && <Sidebar />}

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
              <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                {children}
              </main>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
