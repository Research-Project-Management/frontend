import React from "react";
import { SideBar as Sidebar } from '@/features/settings/components/layout/SideBar';


export default function SettingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background overflow-hidden relative select-none">
      <Sidebar />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
