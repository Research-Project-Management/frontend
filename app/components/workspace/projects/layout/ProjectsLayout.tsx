import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import SideBar from "./SideBar";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function ProjectsLayout() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const location = useLocation();

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
          <SideBar onToggle={() => setIsSidebarVisible(false)} />
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              // Only trigger animation when the base section changes (overview, tasks, settings, etc.)
              // to avoid re-animating the whole layout when navigating inside sub-sections (like settings tabs)
              key={location.pathname.split('/').slice(0, 5).join('/')}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="h-full w-full min-w-0"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
