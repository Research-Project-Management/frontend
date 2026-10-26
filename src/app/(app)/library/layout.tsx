'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { LibrarySidebar as Sidebar } from '@/features/library/ui/sidebar/LibrarySidebar';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import React from "react";

const LibraryModals = dynamic(
  () => import('@/features/library/ui/modals/LibraryModals').then((m) => m.LibraryModals),
  { ssr: false }
);

function LibraryModalsSlot() {
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const isProcessOpen = useProcessModalStore((s) => s.state.isOpen || s.state.isMinimized);
  if (!activeModal && !isProcessOpen) return null;
  return <LibraryModals />;
}

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
        <LibraryModalsSlot />
      </main>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 relative">
      {isSidebarOpen && <Sidebar />}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
      <LibraryModalsSlot />
    </div>
  );
}
