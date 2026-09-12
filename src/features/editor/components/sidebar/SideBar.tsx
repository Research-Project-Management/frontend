'use client';
import {
  FileText,
  History,
  MessageSquareQuote,
  Search,
  BookMarked,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

import SearchTab from "./search/SearchTab";
import FilesTab from "./explorer/FilesTab";
import AiTab from "./ai/AiTab";
import ReviewTab from "./review/ReviewTab";
import HistoryTab from "./history/HistoryTab";
import CitationTab from "./citation/CitationTab";
import { EditorEventBus } from "@/features/editor/utils/editor.util";
import { logger } from "@/shared/lib/utils";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Search", icon: Search },
  { name: "Citations", icon: BookMarked },
  { name: "Review", icon: MessageSquareQuote },
  { name: "History", icon: History },
  { name: "AI", imageSrc: "/Chat.svg" },
] as const;

export type SidebarTab = (typeof sideBarItems)[number]["name"];

function PanelContent({ tab, onClose }: { tab: SidebarTab; onClose: () => void }) {
  if (tab === "Files") return <FilesTab onClose={onClose} />;
  if (tab === "Search") return <SearchTab onClose={onClose} />;
  if (tab === "Citations") return <CitationTab onClose={onClose} />;
  if (tab === "AI") return <AiTab onClose={onClose} />;
  if (tab === "Review") return <ReviewTab onClose={onClose} />;
  if (tab === "History") return <HistoryTab onClose={onClose} />;
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
    return EditorEventBus.on("flux:open-panel", (detail) => {
      const tabName = typeof detail === "string" ? detail : detail?.panel;
      if (tabName && validTabs.has(tabName as SidebarTab)) {
        setActivePanel(tabName as SidebarTab);
      }
    });
  }, [setActivePanel]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-card">
      {/* Icon strip */}
      <ul className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-card px-1 py-2">
        {sideBarItems.map((item) => {
          const isOpen = activePanel === item.name;
          return (
            <li key={item.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => togglePanel(item.name)}
                    aria-label={`${item.name} panel`}
                    aria-pressed={isOpen}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary",
                      isOpen
                        ? "bg-muted text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {"imageSrc" in item ? (
                      <img
                        src={item.imageSrc}
                        alt={item.name}
                        className={cn(
                          "size-4 shrink-0 transition-all hover:grayscale-0 hover:opacity-100",
                          isOpen ? "grayscale-0 opacity-100" : "grayscale opacity-60",
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!mounted ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={"Files"}
              onClose={() => setActivePanel(null)}
            />
          </div>
        ) : activePanel === null ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs px-3 text-center leading-relaxed">
            Click an icon to open a panel
          </div>
        ) : (
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
