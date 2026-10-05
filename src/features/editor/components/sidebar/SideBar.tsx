'use client';
import {
  FileText,
  Search,
  BookMarked,
  Settings,
  Loader2,
} from "lucide-react";
import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import FilesTab from "./explorer/FilesTab";

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-xs">Loading panel...</span>
  </div>
);

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
import { useSettingsStore, usePageStore } from "@/features/editor/store";
import { usePageComments } from "@/features/editor/hooks/use-comment";
import { usePageSuggestions } from "@/features/editor/hooks/use-suggestion";
import { OverleafReviewIcon } from "./review/subcomponents/OverleafReviewIcon";
import { editorCommandBus } from "@/features/editor/core/command-bus/editor-command-bus";
import { logger } from "@/shared/lib/utils";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Search", icon: Search },
  { name: "Citations", icon: BookMarked },
  { name: "Review", icon: OverleafReviewIcon },
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

  const activePageId = usePageStore((s) => s.activePageId);
  const currentPage = usePageStore((s) => s.currentPage);
  const pageId = activePageId || currentPage?.id;

  const { data: comments = [] } = usePageComments(pageId ?? null);
  const { data: suggestions = [] } = usePageSuggestions(pageId ?? null, 'pending');

  const openCommentsCount = comments.filter((c) => c.status === 'open').length;
  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;
  const totalReviewItems = openCommentsCount + pendingSuggestionsCount;

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

  const setActiveSidebarPanel = useSettingsStore((s) => s.setActiveSidebarPanel);

  useEffect(() => {
    if (mounted && activePanel !== undefined) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activePanel));
      setActiveSidebarPanel(activePanel as any);
    }
  }, [activePanel, mounted, setActiveSidebarPanel]);

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

    const unsubCmdToggle = editorCommandBus.subscribe("sidebar:toggle-panel", (cmd) => {
      if (cmd.panel === "Explorer" || cmd.panel === "Outline") {
        togglePanel("Files");
      } else if (cmd.panel && validTabs.has(cmd.panel as SidebarTab)) {
        togglePanel(cmd.panel as SidebarTab);
      }
    });

    const unsubCmdOpen = editorCommandBus.subscribe("sidebar:open-panel", (cmd) => {
      if (cmd.panel === "Explorer" || cmd.panel === "Outline") {
        setActivePanel("Files");
      } else if (cmd.panel && validTabs.has(cmd.panel as SidebarTab)) {
        setActivePanel(cmd.panel as SidebarTab);
      }
    });

    return () => {
      unsubPanel();
      unsubOpenAi();
      unsubToggleAi();
      unsubCmdToggle();
      unsubCmdOpen();
    };
  }, [setActivePanel, togglePanel]);

  const currentTabId = (activePanel || "Files").toLowerCase();

  return (
    <div className="flex h-full w-full overflow-hidden bg-muted">
      <TooltipProvider delayDuration={150}>
        {/* Icon strip */}
        <ul
          role="tablist"
          aria-label="Sidebar navigation"
          className="flex h-full w-11 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-sidebar py-2 select-none"
        >
          {sideBarItems.map((item) => {
            const isOpen = activePanel === item.name;
            const showBadge = item.name === 'Review' && totalReviewItems > 0;
            const tabId = `sidebar-tab-${item.name.toLowerCase()}`;
            const panelId = `sidebar-panel-${item.name.toLowerCase()}`;

            return (
              <li key={item.name} role="none" className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      id={tabId}
                      aria-controls={panelId}
                      onClick={() => togglePanel(item.name)}
                      aria-label={`${item.name} panel`}
                      aria-selected={isOpen}
                      className={cn(
                        "group relative flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer",
                        isOpen
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-foreground/75 hover:text-foreground hover:bg-sidebar-hover",
                      )}
                    >
                      {"imageSrc" in item ? (
                        <img
                          src={(item as any).imageSrc}
                          alt={item.name}
                          className={cn(
                            "size-4.5 shrink-0 rounded-full transition-opacity duration-150",
                            isOpen ? "opacity-100" : "opacity-85 group-hover:opacity-100",
                          )}
                        />
                      ) : (
                        <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                      )}
                      {showBadge && (
                        <span className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full bg-warning text-11 font-mono font-semibold text-white leading-tight">
                          {totalReviewItems > 99 ? '99+' : totalReviewItems}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                    {showBadge ? ` (${totalReviewItems})` : ''}
                  </TooltipContent>
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
                      ? "bg-sidebar-accent text-foreground font-medium"
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
      </TooltipProvider>

      {/* Stacked panels */}
      <div
        role="tabpanel"
        id={`sidebar-panel-${currentTabId}`}
        aria-labelledby={`sidebar-tab-${currentTabId}`}
        className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background"
      >
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
