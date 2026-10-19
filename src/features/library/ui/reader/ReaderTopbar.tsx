"use client";

import { useState, useEffect, useMemo, memo } from "react";
import {
  Library,
  FileText,
  X,
  Printer,
  Download,
  Maximize2,
  Minimize2,
  ChevronDown,
  Search,
  Check,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu";
import type { ReaderDocument } from "@/features/library/domain/types/reader.types";
import type { ReaderTab } from "@/features/library/core/store/reader.store";

export interface ReaderTopbarProps {
  paper?: ReaderDocument | null;
  tabs?: ReaderTab[];
  activeTabId?: string;
  scopeTitle?: string;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onBack?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
  onExportAnnotatedPdf?: () => void;
  onPrint?: () => void;
}

export type TopbarProps = ReaderTopbarProps;

export const ReaderTopbar = memo(function ReaderTopbar({
  paper,
  tabs = [],
  activeTabId,
  scopeTitle,
  onSelectTab,
  onCloseTab,
  onBack,
  onExportAnnotatedPdf,
  onPrint,
}: TopbarProps) {
  const libraryTitle = scopeTitle || "My Library";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTabsMenuOpen, setIsTabsMenuOpen] = useState(false);
  const [tabSearchQuery, setTabSearchQuery] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Global shortcut for Open-Tabs menu: Ctrl+; (or Cmd+; on Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ";") {
        e.preventDefault();
        setIsTabsMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleFullscreen = () => {
    if (typeof document !== "undefined") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          logger.warn("Fullscreen request denied or not supported", {
            error: err,
          });
        });
      } else {
        document.exitFullscreen().catch((err) => {
          logger.warn("Failed to exit fullscreen", { error: err });
        });
      }
    }
  };

  // If tabs are empty or missing, fallback to single active tab representation
  const effectiveTabs: ReaderTab[] = useMemo(() => {
    return isMounted && tabs.length > 0
      ? tabs.map((t) =>
          t.id === "library" || t.type === "library"
            ? { ...t, title: libraryTitle }
            : t,
        )
      : [
          { id: "library", title: libraryTitle, type: "library" },
          ...(paper
            ? [
                {
                  id: paper.id,
                  title: paper.title || "Untitled Document",
                  type: "paper" as const,
                },
              ]
            : []),
        ];
  }, [isMounted, tabs, libraryTitle, paper]);

  const currentTabId = isMounted
    ? activeTabId || (paper ? paper.id : "library")
    : paper
      ? paper.id
      : "library";
  const isDocumentActive = currentTabId !== "library";

  const filteredTabs = useMemo(() => {
    if (!tabSearchQuery.trim()) return effectiveTabs;
    const q = tabSearchQuery.toLowerCase().trim();
    return effectiveTabs.filter(
      (t) => t.title && t.title.toLowerCase().includes(q),
    );
  }, [effectiveTabs, tabSearchQuery]);

  return (
    <header className="h-10 shrink-0 bg-background border-b border-border flex items-center px-1 select-none z-30 text-12">
      {/* Scrollable Tabs Bar */}
      <div
        role="tablist"
        aria-label="Open document tabs"
        className="flex items-center h-full gap-0.5 overflow-x-auto min-w-0 flex-1 thin-scrollbar pt-1"
      >
        {effectiveTabs.map((tab) => {
          const isActive = tab.id === currentTabId;
          const isLibrary = tab.id === "library" || tab.type === "library";

          if (isLibrary) {
            const tabTitle = tab.title || libraryTitle;
            return (
              <button
                key="library"
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (onSelectTab) onSelectTab("library");
                  else if (onBack) onBack();
                }}
                className={cn(
                  "h-8 px-3 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1 md:before:hidden",
                  isActive
                    ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                    : "text-foreground hover:bg-muted",
                )}
                title={tabTitle}
              >
                <Library
                  className="size-3.5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="truncate max-w-[140px]">{tabTitle}</span>
              </button>
            );
          }

          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => onSelectTab?.(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTab?.(tab.id);
                }
              }}
              className={cn(
                "h-8 px-2.5 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 max-w-[240px] group outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                  : "text-foreground hover:bg-muted",
              )}
              title={tab.title}
            >
              <FileText
                className="size-3.5 shrink-0 text-foreground"
                strokeWidth={1.5}
              />
              <span className="truncate flex-1 font-medium">
                {tab.title || "Untitled Document"}
              </span>

              {onCloseTab && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={cn(
                    "size-4 flex items-center justify-center rounded-sm hover:bg-muted text-foreground transition-all cursor-pointer shrink-0 relative before:absolute before:-inset-2.5 md:before:hidden",
                    isActive
                      ? "opacity-70 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-100 max-md:opacity-100",
                  )}
                  title="Close tab"
                  aria-label={`Close tab ${tab.title}`}
                >
                  <X className="size-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Zotero-native Open-Tabs Menu Button (Ctrl+;) */}
      <div className="flex items-center px-0.5 shrink-0">
        <DropdownMenu open={isTabsMenuOpen} onOpenChange={setIsTabsMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="List all tabs (Ctrl+;)"
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <ChevronDown
                    className="size-3.5 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Open Tabs (Ctrl+;)
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align="end"
            className="w-72 max-h-[380px] flex flex-col p-1.5 text-12 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans"
          >
            {/* Search tabs input */}
            <div className="relative flex items-center mb-1.5">
              <Search
                className="size-3.5 absolute left-2 text-muted-foreground pointer-events-none shrink-0"
                strokeWidth={1.5}
              />
              <Input
                type="text"
                value={tabSearchQuery}
                onChange={(e) => setTabSearchQuery(e.target.value)}
                placeholder="Search open tabs..."
                className="h-7 pl-7 pr-6 text-11 bg-background font-sans"
                autoFocus
              />
              {tabSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTabSearchQuery("")}
                  className="size-4 absolute right-1.5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear tab search"
                >
                  <X className="size-3" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Scrollable tabs list */}
            <div className="overflow-y-auto max-h-[280px] space-y-0.5 thin-scrollbar">
              {filteredTabs.length === 0 ? (
                <div className="py-4 text-center text-11 text-muted-foreground">
                  No matching open tabs
                </div>
              ) : (
                filteredTabs.map((tab) => {
                  const isActive = tab.id === currentTabId;
                  const isLibrary =
                    tab.id === "library" || tab.type === "library";

                  return (
                    <div
                      key={tab.id}
                      onClick={() => {
                        if (isLibrary) {
                          if (onSelectTab) onSelectTab("library");
                          else if (onBack) onBack();
                        } else {
                          onSelectTab?.(tab.id);
                        }
                        setIsTabsMenuOpen(false);
                      }}
                      className={cn(
                        "group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-12 select-none",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isLibrary ? (
                          <Library
                            className="size-3.5 shrink-0 text-foreground"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <FileText
                            className="size-3.5 shrink-0 text-foreground"
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="truncate flex-1 font-sans">
                          {tab.title || "Untitled"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isActive && (
                          <Check
                            className="size-3.5 text-primary shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                        {!isLibrary && onCloseTab && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseTab(tab.id);
                            }}
                            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Close tab"
                            aria-label={`Close tab ${tab.title}`}
                          >
                            <X className="size-3" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side document actions: Print, Export PDF, Fullscreen */}
      <div className="flex items-center gap-1 px-1.5 shrink-0">
        {onPrint && isDocumentActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPrint}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Print document"
              >
                <Printer className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Print (Ctrl+P)
            </TooltipContent>
          </Tooltip>
        )}

        {onExportAnnotatedPdf && isDocumentActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onExportAnnotatedPdf}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Export PDF with annotations"
              >
                <Download className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Export PDF with Annotations
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              ) : (
                <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-11">
            Toggle Fullscreen (F11)
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
});

export { ReaderTopbar as Topbar };
export default ReaderTopbar;
