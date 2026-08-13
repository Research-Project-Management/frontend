'use client';

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { Button } from '@/shared/components/ui/button';

const ProjectsSidebar = dynamic(
  () => import('@/features/workspaces/projects/shell/components/sidebar'),
  { ssr: false, loading: () => null }
);

export default function Layout({ children }: { children?: React.ReactNode }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncSidebar = () => setIsSidebarVisible(!media.matches);

    syncSidebar();
    media.addEventListener("change", syncSidebar);
    return () => media.removeEventListener("change", syncSidebar);
  }, []);

  return (
    <div className="relative flex h-full overflow-hidden bg-background">
      <div
        className={`absolute inset-y-0 left-0 z-40 h-full transition-all duration-300 ease-in-out lg:relative ${
          isSidebarVisible ? "w-60" : "w-0"
        } overflow-hidden bg-card shadow-lg lg:shadow-none`}
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarVisible(true)}
            className="absolute left-4 top-4 z-50 h-9 w-9 rounded-md border border-border bg-card shadow-sm animate-in fade-in slide-in-from-left-2 hover:bg-secondary"
          >
            <PanelLeftOpen className="size-4 text-primary" />
          </Button>
        )}
        {isSidebarVisible && (
          <button
            type="button"
            aria-label="Close project sidebar"
            className="absolute inset-0 z-30 bg-foreground/10 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsSidebarVisible(false)}
          />
        )}
        <div className="relative flex-1 overflow-y-auto">
            <div className="h-full w-full min-w-0">
              {children}
            </div>
        </div>
      </div>
    </div>
  );
}
