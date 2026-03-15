import React, { useState } from "react";
import { Outlet } from "react-router";
import SideBar from "./SideBar";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function ProjectsLayout() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  return (
    <div className="h-full flex overflow-hidden relative">
      <div 
        className={`h-full transition-all duration-300 ease-in-out ${
          isSidebarVisible ? "w-60" : "w-0"
        } border-r border-secondary bg-background overflow-hidden`}
      >
        <div className="w-60 h-full">
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
                className="absolute left-4 top-4 z-50 h-8 w-8 bg-white border border-border shadow-sm hover:bg-secondary rounded-md animate-in fade-in slide-in-from-left-2"
            >
                <PanelLeftOpen className="size-4 text-primary" />
            </Button>
        )}
        <div className="flex-1 overflow-y-auto">
            <Outlet />
        </div>
      </div>
    </div>
  );
}
