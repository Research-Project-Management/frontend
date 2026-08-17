'use client';

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";

const ProjectsSidebar = dynamic(
  () => import('@/features/workspaces/projects/shell/components/Sidebar'),
  { ssr: false, loading: () => null }
);

export default function Layout({ children }: { children?: React.ReactNode }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const pathname = usePathname();

  const isProjectSettings = pathname.includes('/settings');

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncSidebar = () => setIsSidebarVisible(!media.matches);

    syncSidebar();
    media.addEventListener("change", syncSidebar);
    return () => media.removeEventListener("change", syncSidebar);
  }, []);

  if (isProjectSettings) {
    return <div className="h-full w-full overflow-hidden">{children}</div>;
  }

  return (
    <div className="relative flex h-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 z-40 h-full overflow-hidden transition-all duration-300 ease-in-out lg:relative ${
          isSidebarVisible ? "w-60 border-r border-border" : "w-0 border-r-0"
        } bg-transparent`}
      >
        <div className="h-full w-60">
          <ProjectsSidebar onToggle={() => setIsSidebarVisible(false)} />
        </div>
      </div>

      <div
        className="flex-1 min-w-0 flex flex-col h-full bg-background relative"
        style={{ "--header-offset": isSidebarVisible ? "0px" : "48px" } as React.CSSProperties}
      >
        {!isSidebarVisible && (
          <div className="absolute left-4 top-0 h-14 flex items-center z-50 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsSidebarVisible(true)}
              title="Expand sidebar"
              className="p-1.5 -ml-1.5 rounded-md text-foreground hover:bg-muted/80 cursor-pointer transition-colors flex items-center justify-center"
            >
              <PanelLeft className="size-4.5 text-foreground" />
            </button>
          </div>
        )}
        {isSidebarVisible && (
          <button
            type="button"
            aria-label="Close project sidebar"
            className="absolute inset-0 z-30 bg-foreground/10 backdrop-blur-[1px] lg:hidden cursor-pointer"
            onClick={() => setIsSidebarVisible(false)}
          />
        )}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div className="h-full w-full min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
