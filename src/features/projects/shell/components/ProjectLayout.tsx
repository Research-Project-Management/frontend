'use client';

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";

const ProjectsSidebar = dynamic(
  () => import('@/features/projects/shell/components/Sidebar'),
  { ssr: false, loading: () => null }
);

export default function ProjectsLayout({ children }: { children?: React.ReactNode }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const pathname = usePathname();

  // If inside project settings, hide outer project sidebar so settings sidebar has full focus
  const isProjectSettings = pathname.includes('/settings');

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    try {
      const saved = localStorage.getItem('flux:project-sidebar-visible');
      if (saved !== null) {
        // On mobile screens, always default to closed unless user explicitly toggles
        setIsSidebarVisible(isMobile ? false : saved === 'true');
        return;
      }
    } catch {
      // ignore
    }

    setIsSidebarVisible(!isMobile);

    const media = window.matchMedia("(max-width: 1023px)");
    const syncSidebar = () => {
      if (media.matches) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(true);
      }
    };

    media.addEventListener("change", syncSidebar);
    return () => media.removeEventListener("change", syncSidebar);
  }, []);

  // Auto-close sidebar on route change on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarVisible(false);
    }
  }, [pathname]);

  // Global event listener for header menu toggle button
  useEffect(() => {
    const handleToggleEvent = () => {
      setIsSidebarVisible((prev) => !prev);
    };
    window.addEventListener('toggle-project-sidebar', handleToggleEvent);
    return () => window.removeEventListener('toggle-project-sidebar', handleToggleEvent);
  }, []);

  const handleToggleSidebar = (visible: boolean) => {
    setIsSidebarVisible(visible);
    try {
      if (window.innerWidth >= 1024) {
        localStorage.setItem('flux:project-sidebar-visible', String(visible));
      }
    } catch {
      // ignore
    }
  };

  if (isProjectSettings) {
    return <div className="h-full w-full overflow-hidden">{children}</div>;
  }

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {isSidebarVisible && (
        <button
          type="button"
          aria-label="Close project sidebar"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden cursor-pointer animate-in fade-in duration-200"
          onClick={() => handleToggleSidebar(false)}
        />
      )}

      {/* Project Sidebar Panel */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto h-full overflow-hidden transition-all duration-300 ease-in-out bg-background ${isSidebarVisible
            ? "w-60 border-r border-border shadow-2xl lg:shadow-none"
            : "w-0 border-r-0 pointer-events-none lg:pointer-events-auto"
          }`}
      >
        <div className="h-full w-60 bg-background">
          <ProjectsSidebar onToggle={() => handleToggleSidebar(false)} />
        </div>
      </div>

      <div
        className="flex-1 min-w-0 flex flex-col h-full bg-background relative"
        style={{ '--header-offset': !isSidebarVisible ? '46px' : '0px' } as React.CSSProperties}
      >
        {!isSidebarVisible && (
          <div className="absolute top-2 left-2.5 z-30">
            <button
              type="button"
              onClick={() => handleToggleSidebar(true)}
              aria-label="Open project sidebar"
              title="Open project sidebar"
              className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
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
