import React from "react";
import { SideBar as Sidebar } from '@/features/workspaces/settings';


export default function SettingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main className="flex-1 min-h-0 overflow-y-auto relative">
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
