"use client";

import React from "react";
import { ListTree, LayoutGrid, Highlighter } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type ReaderSidebarTab = "outline" | "pages" | "annotations";

export interface ReaderLeftRailProps {
  activeTab: ReaderSidebarTab;
  onTabChange: (tab: ReaderSidebarTab) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  annotationsCount?: number;
  className?: string;
}

interface NavTabItem {
  id: ReaderSidebarTab;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number | string;
  }>;
  badge?: number;
}

/**
 * ReaderLeftRail
 * Vertical Navigation Activity Rail for the Reader Left Sidebar.
 * Mirrors the design pattern of the right InspectorTabs (w-10, h-full, border-r, icon buttons with tooltips).
 */
export function ReaderLeftRail({
  activeTab,
  onTabChange,
  isOpen,
  onToggleOpen,
  annotationsCount = 0,
  className,
}: ReaderLeftRailProps) {
  const tabs: NavTabItem[] = [
    { id: "outline", label: "Document Outline", icon: ListTree },
    { id: "pages", label: "Thumbnails & Pages", icon: LayoutGrid },
    { id: "annotations", label: "Annotations & Notes", icon: Highlighter },
  ];

  return (
    <aside
      aria-label="Reader navigation bar"
      className={cn(
        "w-10 shrink-0 h-full min-h-full self-stretch border-r border-border bg-background flex flex-col items-center select-none z-20",
        className,
      )}
    >
      {/* Middle: Icon Tabs */}
      <div className="flex flex-col items-center gap-1 w-full pt-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isOpen && activeTab === tab.id;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isOpen) {
                      onToggleOpen();
                    }
                    onTabChange(tab.id);
                  }}
                  className={cn(
                    "relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer text-foreground before:absolute before:-inset-1.5 md:before:hidden",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-foreground hover:bg-muted font-normal",
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6} className="text-xs">
                <span>{tab.label}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1" />
    </aside>
  );
}

export default ReaderLeftRail;
