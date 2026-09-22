'use client';
import {
  FileText,
  MessageSquareQuote,
  Search,
  BookMarked,
  Settings,
  ListTree,
  Loader2,
} from "lucide-react";
import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

import FilesTab from "./explorer/FilesTab";

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-xs">Loading panel...</span>
  </div>
);

const OutlineTab = dynamic(() => import("./outline/OutlineTab"), {
  ssr: false,
  loading: PanelLoadingFallback,
});
const SearchTab = dynamic(() => import("./search/SearchTab"), {
  ssr: false,
  loading: PanelLoadingFallback,
});
const CitationTab = dynamic(() => import("./citation/CitationTab"), {
  ssr: false,
  loading: PanelLoadingFallback,
});
const ReviewTab = dynamic(() => import("./review/ReviewTab"), {
  ssr: false,
  loading: PanelLoadingFallback,
});
const AiTab = dynamic(() => import("./ai/AiTab"), {
  ssr: false,
  loading: PanelLoadingFallback,
});

import StickyDock from "@/features/shell/components/StickyDock";
import { EditorEventBus } from "@/features/editor/utils/editor.util";
import { useSettingsStore } from "@/features/editor/store";
import { logger } from "@/shared/lib/utils";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Outline", icon: ListTree },
  { name: "Search", icon: Search },
  { name: "Citations", icon: BookMarked },
  { name: "Review", icon: MessageSquareQuote },
  { name: "AI", imageSrc: "/Chat.svg" },
] as const;

export type SidebarTab = (typeof sideBarItems)[number]["name"];

function PanelContent({ tab, onClose }: { tab: SidebarTab; onClose: () => void }) {
  if (tab === "Files") return <FilesTab onClose={onClose} />;
  if (tab === "Outline") return <OutlineTab onClose={onClose} />;
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

const SideBar = React.memo(function SideBar({
  activePanel: controlledActivePanel,
  onActivePanelChange,
}: SideBarProps = {}) {
  const [internalActivePanel, setInternalActivePanel] = useState<SidebarTab | null>("Files");
  const [mounted, setMounted] = useState(false);
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);

  const isControlled = controlledActivePanel !== undefined;
  const activePanel = isControlled ? controlledActivePanel : internalActivePanel;

  const activePanelRef = useRef<SidebarTab | null>(activePanel);
  activePanelRef.current = activePanel;

  const setActivePanel = useCallback((panel: SidebarTab | null) => {
    if (!isControlled) setInternalActivePanel(panel);
    onActivePanelChange?.(panel);
  }, [isControlled, onActivePanelChange]);

  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
  }, [setActivePanel]);

  useEffect(() => {
    setMounted(true);
    const loaded = loadPanel();
    if (!isControlled) setInternalActivePanel(loaded);
    else onActivePanelChange?.(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePanel = useCallback((name: SidebarTab) => {
    setActivePanel(activePanelRef.current === name ? null : name);
  }, [setActivePanel]);

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

        {/* Sticky Trigger like workspace sidebar */}
        <li role="none" className="mt-auto">
          <StickyDock />
        </li>

        {/* Overleaf Settings Icon at Bottom of Sidebar */}
        <li role="none">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSettingsPanel}
                aria-label="Settings"
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer",
                  settingsPanelOpen
                    ? "bg-sidebar-accent text-foreground shadow-2xs font-medium"
                    : "text-foreground/75 hover:text-foreground hover:bg-sidebar-hover",
                )}
              >
                <Settings className="size-4 shrink-0" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </li>
      </ul>

      {/* Stacked panels */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {!mounted ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={"Files"}
              onClose={handleClosePanel}
            />
          </div>
        ) : activePanel === null ? null : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={activePanel}
              onClose={handleClosePanel}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default SideBar;
