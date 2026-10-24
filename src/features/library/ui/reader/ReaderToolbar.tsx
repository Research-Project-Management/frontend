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
  ChevronDown,
  Highlighter,
  Underline,
  StickyNote,
  Type,
  Scan,
  Search,
  RotateCw,
  Check,
  Undo2,
  Lock,
  Unlock,
  Columns2,
  Rows2,
  Square,
  Baseline,
  Hand,
  MousePointer,
  Loader2,
  ScanText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { ReaderAnnotationTool } from "@/features/library/core/store/reader.store";

export interface ReaderToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePage: number;
  numPages: number;
  onNavigateToPage: (page: number) => void;
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;
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
  onToggleThemeMode?: () => void;
  splitMode?: "none" | "horizontal" | "vertical";
  onSelectSplitMode?: (mode: "none" | "horizontal" | "vertical") => void;
  onToggleSearch?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isScanned?: boolean;
  ocrStatus?: "pending" | "processing" | "ready" | "completed" | "none";
  onTriggerOcr?: () => void;
}

import {
  ANNOTATION_PALETTE_COLORS,
} from "@/features/library/domain/reader.domain";
export { ANNOTATION_PALETTE_COLORS };

const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2.0 },
] as const;

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

function ToolbarIconButton({
  onClick,
  disabled,
  active,
  ariaLabel,
  tooltip,
  className,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent text-foreground hover:bg-muted",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export const ReaderToolbar = memo(function ReaderToolbar({
  isSidebarOpen,
  onToggleSidebar,
  visiblePage,
  numPages,
  onNavigateToPage,
  canNavigateBack = false,
  onNavigateBack,
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
  fitMode = "auto",
  onSelectFitMode,
  themeMode = "normal",
  onToggleThemeMode,
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

  // Zotero behavior: clicking the currently active tool toggles back to pointer
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
        {/* Toggle Left Sidebar */}
        <ToolbarIconButton
          onClick={onToggleSidebar}
          active={false}
          ariaLabel={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          tooltip={
            isSidebarOpen ? "Close sidebar" : "Open sidebar"
          }
        >
          <PanelLeft className="size-4 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        {/* Zoom Controls: Out, In, Auto Width */}
        <ToolbarIconButton
          onClick={onZoomOut}
          ariaLabel="Zoom out"
          tooltip="Zoom Out (Ctrl+-)"
        >
          <ZoomOut className="size-3.5 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-1.5 flex items-center gap-0.5 rounded-md hover:bg-muted text-foreground font-mono text-11 transition-colors cursor-pointer tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Zoom percentage"
            >
              <span>{Math.round(zoom * 100)}%</span>
              <ChevronDown
                className="size-2.5 opacity-60 shrink-0"
                strokeWidth={1.5}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="w-28 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans"
          >
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.label}
                onClick={() => onSetZoom?.(preset.value)}
                className="cursor-pointer text-11 font-mono flex items-center justify-between tabular-nums"
              >
                <span>{preset.label}</span>
                {Math.abs(zoom - preset.value) < 0.05 && (
                  <Check
                    className="size-3 text-primary shrink-0"
                    strokeWidth={1.5}
                  />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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

        {/* Back in History (Zotero navigateBack) */}
        {onNavigateBack && (
          <>
            <div className="w-px h-3.5 bg-border mx-0.5" />
            <ToolbarIconButton
              onClick={onNavigateBack}
              disabled={!canNavigateBack}
              ariaLabel="Navigate back in document"
              tooltip="Back (Alt+Left)"
            >
              <Undo2 className="size-3.5 shrink-0" strokeWidth={1.5} />
            </ToolbarIconButton>
          </>
        )}

        <div className="w-px h-3.5 bg-border mx-0.5" />

        {/* Page Navigation */}
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
        {/* Pointer Mode & Hand Mode */}
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

        {/* 5 Annotation Tools: Highlight, Underline, Note, Text, Area */}
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

        {/* Scanned Paper OCR Trigger */}
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

        {/* Color Picker Dropdown (Zotero 8 Colors) */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-1.5 flex items-center gap-1 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Pick annotation color"
                >
                  <span
                    className="size-3.5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: activeColor }}
                  />
                  <ChevronDown
                    className="size-2.5 opacity-60 shrink-0"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pick Color</TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align="center"
            className="p-1.5 grid grid-cols-4 gap-1 min-w-0 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans"
          >
            {ANNOTATION_PALETTE_COLORS.map((c) => (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelectColor?.(c.hex)}
                    aria-label={`Color ${c.label}`}
                    className={cn(
                      "size-5 rounded-full border border-border transition-colors cursor-pointer relative flex items-center justify-center",
                      activeColor === c.hex &&
                        "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {activeColor === c.hex && (
                      <Check
                        className="size-3 text-background drop-shadow-xs"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11 py-0.5 px-1.5">
                  {c.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tool Lock Button */}
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
        {/* Zotero Appearance Popup Menu (Aa) */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Appearance & Display settings"
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Baseline className="size-4 shrink-0" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Appearance & View</TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align="end"
            className="w-56 text-xs p-1.5 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans space-y-1"
          >
            {/* Group 1: Page Scroll & Spread Mode */}
            {onSelectViewMode && (
              <>
                <DropdownMenuLabel className="text-10 font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Page Layout
                </DropdownMenuLabel>
                {(
                  [
                    ["continuous", "Continuous Scroll"],
                    ["single", "Single Page"],
                    ["spread", "Two Pages (Spread)"],
                  ] as const
                ).map(([mode, label]) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => onSelectViewMode(mode)}
                    className="cursor-pointer text-11 flex items-center justify-between px-2 py-1.5"
                  >
                    <span>{label}</span>
                    {viewMode === mode && (
                      <Check
                        className="size-3 text-primary shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {/* Group 2: Split View */}
            {onSelectSplitMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-10 font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Split View
                </DropdownMenuLabel>
                {(
                  [
                    ["none", "No Split", Square],
                    ["vertical", "Vertical Split", Columns2],
                    ["horizontal", "Horizontal Split", Rows2],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => onSelectSplitMode(mode)}
                    className="cursor-pointer text-11 flex items-center justify-between px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className="size-3 text-foreground shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>{label}</span>
                    </div>
                    {splitMode === mode && (
                      <Check
                        className="size-3 text-primary shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {/* Group 3: Reading Theme */}
            {onToggleThemeMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-10 font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Reading Theme
                </DropdownMenuLabel>
                <div
                  role="radiogroup"
                  aria-label="Reading Theme"
                  className="flex items-center gap-1.5 px-2 py-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={themeMode === "normal"}
                    onClick={() =>
                      themeMode !== "normal" && onToggleThemeMode()
                    }
                    className={cn(
                      "flex-1 py-1 text-center text-11 rounded-sm border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      themeMode === "normal"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={themeMode === "sepia"}
                    onClick={() => themeMode !== "sepia" && onToggleThemeMode()}
                    className={cn(
                      "flex-1 py-1 text-center text-11 rounded-sm border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      themeMode === "sepia"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    Sepia
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={themeMode === "dark"}
                    onClick={() => themeMode !== "dark" && onToggleThemeMode()}
                    className={cn(
                      "flex-1 py-1 text-center text-11 rounded-sm border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      themeMode === "dark"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    Dark
                  </button>
                </div>
              </>
            )}

            {/* Group 4: Rotate */}
            {onRotate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRotate}
                  className="cursor-pointer text-11 flex items-center justify-between px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <RotateCw
                      className="size-3 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>Rotate 90°</span>
                  </div>
                  {rotation !== 0 && (
                    <span className="text-10 font-mono text-muted-foreground">
                      {rotation}°
                    </span>
                  )}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Find in Document (Ctrl+F) */}
        {onToggleSearch && (
          <ToolbarIconButton
            onClick={onToggleSearch}
            ariaLabel="Find in document"
            tooltip="Find (Ctrl+F)"
          >
            <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>
        )}

        {/* Toggle Right Context Pane / Inspector */}
        <ToolbarIconButton
          onClick={onToggleInspector}
          active={isInspectorOpen}
          ariaLabel={
            isInspectorOpen ? "Close details pane" : "Open details pane"
          }
          tooltip={
            isInspectorOpen ? "Close details" : "Open details"
          }
        >
          <PanelRight className="size-4 shrink-0" strokeWidth={1.5} />
        </ToolbarIconButton>
      </div>
    </div>
  );
});

export default ReaderToolbar;
