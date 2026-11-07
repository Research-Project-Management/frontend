"use client";

import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Library,
  FileText,
  X,
  Download,
  Maximize2,
  Minimize2,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { safeHttpUrl } from "@/features/library/domain/system-views.policy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { ReaderDocument } from "@/features/library/types/reader.types";
import type { ReaderTab } from "@/features/library/core/store/reader.store";

export {
  ReaderLeftRail,
  type ReaderSidebarTab,
  type ReaderLeftRailProps,
} from "./ReaderThumbnailsPanel";

interface ReaderRetractionBannerProps {
  paper?: {
    isRetracted?: boolean;
    retractionNature?: string;
    [key: string]: unknown;
  } | null;
  retractionDetails?: {
    reason?: string;
    noticeUrl?: string;
    [key: string]: unknown;
  } | null;
}

export function ReaderRetractionBanner({
  paper,
  retractionDetails,
}: ReaderRetractionBannerProps) {
  if (!paper?.isRetracted) return null;

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-12 z-30 shrink-0 border-b border-destructive/20 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="size-4 shrink-0 text-destructive-foreground" />
        <span className="font-semibold tracking-normal">
          {paper.retractionNature === "expression_of_concern"
            ? "Expression of Concern"
            : paper.retractionNature === "correction"
              ? "Publisher Correction"
              : "Retracted Publication"}
        </span>
        <span className="text-destructive-foreground/90 truncate max-w-xl">
          -{" "}
          {retractionDetails?.reason ||
            "This publication has been flagged as retracted or unreliable."}
        </span>
      </div>
      {safeHttpUrl(retractionDetails?.noticeUrl) && (
        <a
          href={safeHttpUrl(retractionDetails?.noticeUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-12 text-destructive-foreground underline font-medium hover:text-destructive-foreground/80 shrink-0 ml-4 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Notice <ExternalLink className="size-3 shrink-0" />
        </a>
      )}
    </div>
  );
}

interface ReaderTopbarProps {
  paper?: ReaderDocument | null;
  tabs?: ReaderTab[];
  activeTabId?: string;
  scopeTitle?: string;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onReorderTabs?: (nextTabs: ReaderTab[]) => void;
  onPrefetchTab?: (id: string) => void;
  onBack?: () => void;
  onExportAnnotatedPdf?: () => void;
}

interface SortableTabItemProps {
  tab: ReaderTab;
  isActive: boolean;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onPrefetchTab?: (id: string) => void;
}

const SortableTabItem = memo(function SortableTabItem({
  tab,
  isActive,
  onSelectTab,
  onCloseTab,
  onPrefetchTab,
}: SortableTabItemProps) {
  const {
    attributes: {
      role: _sortableRole,
      tabIndex: _sortableTabIndex,
      ...sortableAttributes
    },
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 30 : isActive ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={() => onSelectTab?.(tab.id)}
      onAuxClick={(e) => {
        if (e.button === 1 && onCloseTab) {
          e.preventDefault();
          onCloseTab(tab.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectTab?.(tab.id);
        }
      }}
      className={cn(
        "h-8 px-2.5 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 max-w-[240px] group outline-none focus-visible:ring-1 focus-visible:ring-primary select-none",
        isActive
          ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
          : "text-muted-foreground hover:text-foreground hover:bg-background/60",
      )}
      title={tab.title}
      onMouseEnter={() => onPrefetchTab?.(tab.id)}
      {...sortableAttributes}
      {...listeners}
    >
      <FileText className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
      <span className="truncate flex-1 font-medium">{tab.title || "Untitled Document"}</span>

      {onCloseTab && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCloseTab(tab.id);
          }}
          className={cn(
            "size-4 flex items-center justify-center rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0 relative before:absolute before:-inset-2.5 md:before:hidden",
            isActive
              ? "opacity-70 hover:opacity-100"
              : "opacity-0 group-hover:opacity-100 max-md:opacity-100",
          )}
          aria-label={`Close tab ${tab.title}`}
        >
          <X className="size-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
});

export const ReaderTopbar = memo(function ReaderTopbar({
  paper,
  tabs = [],
  activeTabId,
  scopeTitle,
  onSelectTab,
  onCloseTab,
  onReorderTabs,
  onPrefetchTab,
  onBack,
  onExportAnnotatedPdf,
}: ReaderTopbarProps) {
  const libraryTitle = scopeTitle || "My Library";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortableItemIds = useMemo(
    () =>
      effectiveTabs
        .filter((t) => t.id !== "library" && t.type !== "library")
        .map((t) => t.id),
    [effectiveTabs],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderTabs) return;

      const oldIndex = effectiveTabs.findIndex((t) => t.id === active.id);
      const newIndex = effectiveTabs.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(effectiveTabs, oldIndex, newIndex);
        const libIdx = reordered.findIndex((t) => t.id === "library" || t.type === "library");
        if (libIdx > 0) {
          const [libTab] = reordered.splice(libIdx, 1);
          reordered.unshift(libTab);
        }
        onReorderTabs(reordered);
      }
    },
    [effectiveTabs, onReorderTabs],
  );

  return (
    <header className="h-10 shrink-0 bg-muted/40 border-b border-border flex items-center px-1 select-none z-30 text-12">
      {/* Scrollable Tabs Bar */}
      <div
        role="tablist"
        aria-label="Open document tabs"
        className="flex items-center h-full gap-0.5 overflow-x-auto min-w-0 flex-1 thin-scrollbar pt-1"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableItemIds}
            strategy={horizontalListSortingStrategy}
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
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                    )}
                  >
                    <Library
                      className="size-3.5 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="font-sans font-medium">{tabTitle}</span>
                  </button>
                );
              }

              return (
                <SortableTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={isActive}
                  onSelectTab={onSelectTab}
                  onCloseTab={onCloseTab}
                  onPrefetchTab={onPrefetchTab}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Right side document actions: Print, Export PDF, Fullscreen */}
      <div className="flex items-center gap-1 px-1.5 shrink-0">

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

export default ReaderTopbar;
