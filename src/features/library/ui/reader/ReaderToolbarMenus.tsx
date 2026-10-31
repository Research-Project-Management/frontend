"use client";

import React from "react";
import {
  ChevronDown,
  RotateCw,
  Check,
  Columns2,
  Rows2,
  Square,
  Baseline,
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
import { ANNOTATION_PALETTE_COLORS } from "@/features/library/domain/reader.domain";

export const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2.0 },
] as const;

export function ToolbarIconButton({
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
          data-active={active || undefined}
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

export function ReaderZoomDropdown({
  zoom,
  onSetZoom,
}: {
  zoom: number;
  onSetZoom?: (zoom: number) => void;
}) {
  return (
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
  );
}

export function ReaderColorPickerDropdown({
  activeColor,
  onSelectColor,
}: {
  activeColor: string;
  onSelectColor?: (hex: string) => void;
}) {
  return (
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
  );
}

export interface ReaderAppearanceMenuProps {
  viewMode?: "single" | "continuous" | "spread";
  onSelectViewMode?: (mode: "single" | "continuous" | "spread") => void;
  splitMode?: "none" | "horizontal" | "vertical";
  onSelectSplitMode?: (mode: "none" | "horizontal" | "vertical") => void;
  themeMode?: "normal" | "dark" | "sepia" | "invert";
  onToggleThemeMode?: (mode?: "normal" | "dark" | "sepia" | "invert") => void;
  onSelectThemeMode?: (mode: "normal" | "dark" | "sepia" | "invert") => void;
  rotation?: number;
  onRotate?: () => void;
}

export function ReaderAppearanceMenu({
  viewMode = "continuous",
  onSelectViewMode,
  splitMode = "none",
  onSelectSplitMode,
  themeMode = "normal",
  onToggleThemeMode,
  onSelectThemeMode,
  rotation = 0,
  onRotate,
}: ReaderAppearanceMenuProps) {
  const applyTheme = (mode: "normal" | "sepia" | "dark" | "invert") => {
    if (onSelectThemeMode) {
      onSelectThemeMode(mode);
    } else if (onToggleThemeMode) {
      onToggleThemeMode(mode);
    }
  };

  return (
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
        {(onToggleThemeMode || onSelectThemeMode) && (
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
              {(
                [
                  ["normal", "Light"],
                  ["sepia", "Sepia"],
                  ["dark", "Dark"],
                  ["invert", "Invert"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={themeMode === mode}
                  onClick={() => applyTheme(mode)}
                  className={cn(
                    "flex-1 py-1 text-center text-11 rounded-sm border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    themeMode === mode
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
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
  );
}
