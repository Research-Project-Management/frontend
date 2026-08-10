'use client';

import { usePathname } from 'next/navigation';
import { LibrarySideBar } from "@/features/workspaces";
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname.includes('/reader/');

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {!isReader && (
        <>
          <LibrarySideBar />
          <div className="w-px h-full bg-border shrink-0" />
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        <main className={`flex-1 min-h-0 relative ${isReader ? "flex flex-col" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
