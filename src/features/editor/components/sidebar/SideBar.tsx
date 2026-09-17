'use client';
import {
  FileText,
  MessageSquareQuote,
  Search,
  BookMarked,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

import SearchTab from "./search/SearchTab";
import FilesTab from "./explorer/FilesTab";
import ReviewTab from "./review/ReviewTab";
import CitationTab from "./citation/CitationTab";
import AiTab from "./ai/AiTab";
import { EditorEventBus } from "@/features/editor/utils/editor.util";
import { logger } from "@/shared/lib/utils";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Search", icon: Search },
  { name: "Citations", icon: BookMarked },
  { name: "Review", icon: MessageSquareQuote },
  { name: "AI", imageSrc: "/Chat.svg" },
] as const;

export type SidebarTab = (typeof sideBarItems)[number]["name"];

function PanelContent({ tab, onClose }: { tab: SidebarTab; onClose: () => void }) {
  if (tab === "Files") return <FilesTab onClose={onClose} />;
  if (tab === "Search") return <SearchTab onClose={onClose} />;
  if (tab === "Citations") return <CitationTab onClose={onClose} />;
  if (tab === "Review") return <ReviewTab onClose={onClose} />;
  if (tab === "AI") return <AiTab onClose={onClose} />;
  return null;
}

const STORAGE_KEY = "flux:sidebar:active-panel";
const validTabs = new Set(sideBarItems.map((i) => i.name));

function loadPanel(): SidebarTab | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string" && validTabs.has(parsed as SidebarTab)) {
        return parsed as SidebarTab;
      }
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (t): t is SidebarTab => typeof t === "string" && validTabs.has(t as SidebarTab),
        );
        if (first) return first;
      }
    }
  } catch (err) {
    logger.debug('[SideBar] Failed to parse active panel preference', { err });
  }
  return "Files";
}

export interface SideBarProps {
  activePanel?: SidebarTab | null;
  onActivePanelChange?: (panel: SidebarTab | null) => void;
}

export default function SideBar({
  activePanel: controlledActivePanel,
  onActivePanelChange,
}: SideBarProps = {}) {
  const [internalActivePanel, setInternalActivePanel] = useState<SidebarTab | null>("Files");
  const [mounted, setMounted] = useState(false);

  const isControlled = controlledActivePanel !== undefined;
  const activePanel = isControlled ? controlledActivePanel : internalActivePanel;

  const setActivePanel = useCallback((panel: SidebarTab | null) => {
    if (!isControlled) setInternalActivePanel(panel);
    onActivePanelChange?.(panel);
  }, [isControlled, onActivePanelChange]);

  useEffect(() => {
    setMounted(true);
    const loaded = loadPanel();
    if (!isControlled) setInternalActivePanel(loaded);
    else onActivePanelChange?.(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePanel = (name: SidebarTab) => {
    setActivePanel(activePanel === name ? null : name);
  };

  useEffect(() => {
    if (mounted && activePanel !== undefined) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activePanel));
    }
  }, [activePanel, mounted]);

  useEffect(() => {
    const unsubPanel = EditorEventBus.on("flux:open-panel", (detail) => {
      const tabName = typeof detail === "string" ? detail : detail?.panel;
      if (tabName === "Explorer" || tabName === "Outline") {
        setActivePanel("Files");
      } else if (tabName && validTabs.has(tabName as SidebarTab)) {
        setActivePanel(tabName as SidebarTab);
      }
    });

    const unsubOpenAi = EditorEventBus.on("flux:open-ai-panel", () => {
      setActivePanel("AI");
    });

    const unsubToggleAi = EditorEventBus.on("flux:toggle-ai-panel", () => {
      togglePanel("AI");
    });

    return () => {
      unsubPanel();
      unsubOpenAi();
      unsubToggleAi();
    };
  }, [setActivePanel, togglePanel]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Icon strip */}
      <ul
        role="tablist"
        aria-label="Sidebar navigation"
        className="flex h-full w-11 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-muted py-2 select-none"
      >
        {sideBarItems.map((item) => {
          const isOpen = activePanel === item.name;
          return (
            <li key={item.name} role="none">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="tab"
                    onClick={() => togglePanel(item.name)}
                    aria-label={`${item.name} panel`}
                    aria-selected={isOpen}
                    aria-pressed={isOpen}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer",
                      isOpen
                        ? "bg-sidebar-accent text-foreground shadow-2xs font-medium"
                        : "text-foreground/75 hover:text-foreground hover:bg-sidebar-hover",
                    )}
                  >
                    {"imageSrc" in item ? (
                      <img
                        src={(item as any).imageSrc}
                        alt={item.name}
                        className={cn(
                          "size-4.5 shrink-0 rounded-full transition-transform duration-150",
                          isOpen ? "scale-105" : "opacity-85 hover:opacity-100 hover:scale-105",
                        )}
                      />
                    ) : (
                      <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      {/* Stacked panels */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {!mounted ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={"Files"}
              onClose={() => setActivePanel(null)}
            />
          </div>
        ) : activePanel === null ? null : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={activePanel}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
