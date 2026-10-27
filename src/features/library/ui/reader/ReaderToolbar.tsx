"use client";

import React, { useState, useEffect, memo } from "react";
import {
  PanelLeft,
  PanelRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Underline,
  StickyNote,
  Type,
  Scan,
  Search,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  Hand,
  MousePointer,
  Loader2,
  ScanText,
} from "lucide-react";
import type { ReaderAnnotationTool } from "@/features/library/core/store/reader.store";
import { ANNOTATION_PALETTE_COLORS } from "@/features/library/domain/reader.domain";
import {
  ZOOM_PRESETS,
  ToolbarIconButton,
  ReaderZoomDropdown,
  ReaderColorPickerDropdown,
  ReaderAppearanceMenu,
} from "./ReaderToolbarMenus";

export {
  ANNOTATION_PALETTE_COLORS,
  ZOOM_PRESETS,
  ToolbarIconButton,
  ReaderZoomDropdown,
  ReaderColorPickerDropdown,
  ReaderAppearanceMenu,
};

export interface ReaderToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePage: number;
  numPages: number;
  onNavigateToPage: (page: number) => void;
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;
  canNavigateForward?: boolean;
  onNavigateForward?: () => void;
  interactionMode?: "select" | "hand";
  onSelectInteractionMode?: (mode: "select" | "hand") => void;
  activeTool?: ReaderAnnotationTool;
  onSelectTool?: (tool: ReaderAnnotationTool) => void;
  activeColor?: string;
  onSelectColor?: (hex: string) => void;
  isToolLocked?: boolean;
  onToggleToolLocked?: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom?: (zoom: number) => void;
  onFitWidth?: () => void;
  rotation?: number;
  onRotate?: () => void;
  viewMode?: "single" | "continuous" | "spread";
  onSelectViewMode?: (mode: "single" | "continuous" | "spread") => void;
  fitMode?: "fit-width" | "fit-page" | "auto";
  onSelectFitMode?: (mode: "fit-width" | "fit-page" | "auto") => void;
  themeMode?: "normal" | "dark" | "sepia" | "invert";
  onToggleThemeMode?: (mode?: "normal" | "dark" | "sepia" | "invert") => void;
  onSelectThemeMode?: (mode: "normal" | "dark" | "sepia" | "invert") => void;
  splitMode?: "none" | "horizontal" | "vertical";
  onSelectSplitMode?: (mode: "none" | "horizontal" | "vertical") => void;
  onToggleSearch?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isScanned?: boolean;
  ocrStatus?: "pending" | "processing" | "ready" | "completed" | "none";
  onTriggerOcr?: () => void;
}

const ANNOTATION_TOOLS: Array<{
  id: ReaderAnnotationTool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  {
    id: "highlight",
    label: "Highlight text",
    shortcut: "Highlight (Alt+1)",
    icon: Highlighter,
  },
  {
    id: "underline",
    label: "Underline text",
    shortcut: "Underline (Alt+2)",
    icon: Underline,
  },
  {
    id: "note",
    label: "Add note",
    shortcut: "Add Note (Alt+3)",
    icon: StickyNote,
  },
  { id: "text", label: "Add text", shortcut: "Add Text (Alt+4)", icon: Type },
  {
    id: "area",
    label: "Select area / image",
    shortcut: "Select Area / Image (Alt+5)",
    icon: Scan,
  },
];

export const ReaderToolbar = memo(function ReaderToolbar({
  isSidebarOpen,
  onToggleSidebar,
  visiblePage,
  numPages,
  onNavigateToPage,
  canNavigateBack = false,
  onNavigateBack,
  canNavigateForward = false,
  onNavigateForward,
  interactionMode = "select",
  onSelectInteractionMode,
  activeTool = "highlight",
  onSelectTool,
  activeColor = "#ffd400",
  onSelectColor,
  isToolLocked = false,
  onToggleToolLocked,
  zoom,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitWidth,
  rotation = 0,
  onRotate,
  viewMode = "continuous",
  onSelectViewMode,
  onSelectFitMode,
  themeMode = "normal",
  onToggleThemeMode,
  onSelectThemeMode,
  splitMode = "none",
  onSelectSplitMode,
  onToggleSearch,
  isInspectorOpen,
  onToggleInspector,
  isScanned = false,
  ocrStatus = "none",
  onTriggerOcr,
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState(String(visiblePage));

  useEffect(() => {
    setPageInput(String(visiblePage));
  }, [visiblePage]);

  const commitPageInput = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) {
      onNavigateToPage(val);
    } else {
      setPageInput(String(visiblePage));
    }
  };

  const handleToolClick = (toolId: ReaderAnnotationTool) => {
    if (activeTool === toolId && interactionMode === "select") {
      onSelectInteractionMode?.("select");
    } else {
      onSelectInteractionMode?.("select");
      onSelectTool?.(toolId);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Reader tools and navigation"
      className="h-10 shrink-0 border-b border-border bg-background px-2 flex items-center justify-between gap-2 select-none z-20 text-12 font-sans"
    >
      {/* ── 1. LEFT CLUSTER (.start): Sidebar | Zoom | Back | Page Nav ── */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolbarIconButton
          onClick={onToggleSidebar}
          active={false}
          ariaLabel={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <PanelLeft className="size-4 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <ToolbarIconButton
          onClick={onZoomOut}
          ariaLabel="Zoom out"
          tooltip="Zoom Out (Ctrl+-)"
        >
          <ZoomOut className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <ReaderZoomDropdown zoom={zoom} onSetZoom={onSetZoom} />

        <ToolbarIconButton
          onClick={onZoomIn}
          ariaLabel="Zoom in"
          tooltip="Zoom In (Ctrl++)"
        >
          <ZoomIn className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        {onFitWidth && (
          <ToolbarIconButton
            onClick={() => {
              onSelectFitMode?.("fit-width");
              onFitWidth();
            }}
            ariaLabel="Fit to width"
            tooltip="Fit to Width (Auto)"
          >
            <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>
        )}

        {(onNavigateBack || onNavigateForward) && (
          <>
            <div className="w-px h-3.5 bg-border mx-0.5" />
            {onNavigateBack && (
              <ToolbarIconButton
                onClick={onNavigateBack}
                disabled={!canNavigateBack}
                ariaLabel="Navigate back in document"
                tooltip="Back (Alt+Left)"
              >
                <Undo2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              </ToolbarIconButton>
            )}
            {onNavigateForward && (
              <ToolbarIconButton
                onClick={onNavigateForward}
                disabled={!canNavigateForward}
                ariaLabel="Navigate forward in document"
                tooltip="Forward (Alt+Right)"
              >
                <Redo2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              </ToolbarIconButton>
            )}
          </>
        )}

        <div className="w-px h-3.5 bg-border mx-0.5" />

        <ToolbarIconButton
          onClick={() => onNavigateToPage(Math.max(1, visiblePage - 1))}
          disabled={visiblePage <= 1}
          ariaLabel="Previous page"
          tooltip="Previous page (PageUp)"
        >
          <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <ToolbarIconButton
          onClick={() =>
            onNavigateToPage(Math.min(numPages || 1, visiblePage + 1))
          }
          disabled={visiblePage >= (numPages || 1)}
          ariaLabel="Next page"
          tooltip="Next page (PageDown)"
        >
          <ChevronRight className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitPageInput();
          }}
          className="flex items-center gap-1 font-mono text-11 ml-0.5"
        >
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setPageInput(String(visiblePage));
                e.currentTarget.blur();
              }
            }}
            className="w-9 h-6 text-center text-11 font-mono rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Current page number"
          />
          <span className="text-muted-foreground text-11 font-mono">/</span>
          <span className="text-muted-foreground min-w-[14px] text-11 font-mono tabular-nums">
            {numPages || 1}
          </span>
        </form>
      </div>

      {/* ── 2. CENTER CLUSTER (.center.tools): Annotation Tools + Color + Tool Lock ── */}
      <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md border border-border shrink-0">
        <ToolbarIconButton
          onClick={() => onSelectInteractionMode?.("select")}
          active={interactionMode === "select"}
          ariaLabel="Text selection mode"
          tooltip="Select (S)"
        >
          <MousePointer className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <ToolbarIconButton
          onClick={() => onSelectInteractionMode?.("hand")}
          active={interactionMode === "hand"}
          ariaLabel="Hand / Pan mode"
          tooltip="Hand (H)"
        >
          <Hand className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <div className="w-px h-3.5 bg-border mx-0.5" />

        {ANNOTATION_TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
          <ToolbarIconButton
            key={id}
            onClick={() => handleToolClick(id)}
            active={activeTool === id && interactionMode === "select"}
            ariaLabel={label}
            tooltip={shortcut}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
            {id === "highlight" && (
              <span
                className="absolute bottom-1 w-3 h-0.5 rounded-full"
                style={{ backgroundColor: activeColor }}
              />
            )}
          </ToolbarIconButton>
        ))}

        {isScanned && onTriggerOcr && (
          <ToolbarIconButton
            onClick={onTriggerOcr}
            disabled={ocrStatus === "processing"}
            ariaLabel="Extract text via OCR"
            tooltip="OCR Document"
          >
            {ocrStatus === "processing" ? (
              <Loader2
                className="size-3.5 animate-spin text-primary shrink-0"
                strokeWidth={1.5}
              />
            ) : (
              <ScanText
                className="size-3.5 text-primary shrink-0"
                strokeWidth={1.5}
              />
            )}
          </ToolbarIconButton>
        )}

        <div className="w-px h-3.5 bg-border mx-0.5" />

        <ReaderColorPickerDropdown
          activeColor={activeColor}
          onSelectColor={onSelectColor}
        />

        {onToggleToolLocked && (
          <ToolbarIconButton
            onClick={onToggleToolLocked}
            active={isToolLocked}
            ariaLabel={isToolLocked ? "Unlock tool" : "Lock tool"}
            tooltip={
              isToolLocked
                ? "Tool Locked (Tool stays active after use)"
                : "Lock Tool (Stay active)"
            }
            className={
              isToolLocked
                ? "ml-0.5 bg-primary/10 text-primary border border-primary"
                : "ml-0.5"
            }
          >
            {isToolLocked ? (
              <Lock className="size-3.5 shrink-0" strokeWidth={1.5} />
            ) : (
              <Unlock className="size-3.5 shrink-0" strokeWidth={1.5} />
            )}
          </ToolbarIconButton>
        )}
      </div>

      {/* ── 3. RIGHT CLUSTER (.end): Appearance (Aa) | Find (Ctrl+F) | Inspector Toggle ── */}
      <div className="flex items-center gap-1 shrink-0">
        <ReaderAppearanceMenu
          viewMode={viewMode}
          onSelectViewMode={onSelectViewMode}
          splitMode={splitMode}
          onSelectSplitMode={onSelectSplitMode}
          themeMode={themeMode}
          onToggleThemeMode={onToggleThemeMode}
          onSelectThemeMode={onSelectThemeMode}
          rotation={rotation}
          onRotate={onRotate}
        />

        {onToggleSearch && (
          <ToolbarIconButton
            onClick={onToggleSearch}
            ariaLabel="Find in document"
            tooltip="Find (Ctrl+F)"
          >
            <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>
        )}

        <ToolbarIconButton
          onClick={onToggleInspector}
          active={isInspectorOpen}
          ariaLabel={
            isInspectorOpen ? "Close details pane" : "Open details pane"
          }
          tooltip={isInspectorOpen ? "Close details" : "Open details"}
        >
          <PanelRight className="size-4 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>
      </div>
    </div>
  );
});

export default ReaderToolbar;
