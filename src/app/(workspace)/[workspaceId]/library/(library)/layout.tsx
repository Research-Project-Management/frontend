'use client';

import Sidebar from "@/features/workspaces/library/components/sidebar/Sidebar";
import React from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <div className="w-px h-full bg-border shrink-0" />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        <main className="flex-1 min-h-0 relative overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
