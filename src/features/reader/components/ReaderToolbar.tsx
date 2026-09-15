'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  PenTool,
  Search,
  RotateCw,
  Sun,
  Moon,
  Hand,
  MousePointer,
  Check,
  Layers,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Form,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { pageNavFormSchema } from '../schemas/reader.schema';
import type { PageNavFormData } from '../types/reader.types';
import type { ReaderAnnotationTool } from '../store/reader.store';

export interface ReaderToolbarProps {
  // Navigation & Shell
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePage: number;
  numPages: number;
  onNavigateToPage: (page: number) => void;

  // Interaction Mode (Select vs Hand)
  interactionMode?: 'select' | 'hand';
  onSelectInteractionMode?: (mode: 'select' | 'hand') => void;

  // Active Tool & Color
  activeTool?: ReaderAnnotationTool;
  onSelectTool?: (tool: ReaderAnnotationTool) => void;
  activeColor?: string;
  onSelectColor?: (hex: string) => void;

  // Zoom & View
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom?: (zoom: number) => void;
  onFitWidth?: () => void;
  rotation?: number;
  onRotate?: () => void;
  themeMode?: 'normal' | 'sepia' | 'dark';
  onToggleThemeMode?: () => void;

  // Search & Inspector & Entities
  onToggleSearch?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isEntitiesDrawerOpen?: boolean;
  onToggleEntitiesDrawer?: () => void;
}

export const ZOTERO_COLORS = [
  { id: 'yellow', label: 'Yellow', hex: '#ffd400' },
  { id: 'red', label: 'Red', hex: '#ff6666' },
  { id: 'green', label: 'Green', hex: '#5fb236' },
  { id: 'blue', label: 'Blue', hex: '#2ea8e5' },
  { id: 'purple', label: 'Purple', hex: '#a28ae5' },
  { id: 'magenta', label: 'Magenta', hex: '#e56eee' },
  { id: 'orange', label: 'Orange', hex: '#f19837' },
  { id: 'gray', label: 'Gray', hex: '#aaaaaa' },
];

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
];

export function ReaderToolbar({
  isSidebarOpen,
  onToggleSidebar,
  visiblePage,
  numPages,
  onNavigateToPage,
  interactionMode = 'select',
  onSelectInteractionMode,
  activeTool = 'highlight',
  onSelectTool,
  activeColor = '#ffd400',
  onSelectColor,
  zoom,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFitWidth,
  rotation = 0,
  onRotate,
  themeMode = 'normal',
  onToggleThemeMode,
  onToggleSearch,
  isInspectorOpen,
  onToggleInspector,
  isEntitiesDrawerOpen = false,
  onToggleEntitiesDrawer,
}: ReaderToolbarProps) {
  const pageNavForm = useForm<PageNavFormData>({
    resolver: zodResolver(pageNavFormSchema),
    defaultValues: {
      page: visiblePage,
    },
  });
  const { register, handleSubmit, reset } = pageNavForm;

  useEffect(() => {
    reset({ page: visiblePage });
  }, [visiblePage, reset]);

  const handlePageSubmit = (data: PageNavFormData) => {
    const p = data.page;
    if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
      onNavigateToPage(p);
    } else {
      reset({ page: visiblePage });
    }
  };

  return (
    <div className="h-9 shrink-0 border-b border-border bg-background px-2 flex items-center justify-between select-none z-20 text-xs overflow-x-auto min-w-0 thin-scrollbar gap-2">
      <TooltipProvider delayDuration={300}>
        {/* ── CỤM TRÁI: Điều hướng cấu trúc & Phân trang ──────────────────────── */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Sidebar Toggle [| ] */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSidebar}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  isSidebarOpen
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Toggle navigation sidebar"
              >
                <PanelLeft className="size-4 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              {isSidebarOpen ? "Close sidebar (Ctrl+\\)" : "Open sidebar (Ctrl+\\)"}
            </TooltipContent>
          </Tooltip>

          {/* Academic Entities Drawer Toggle (Figures, Tables, Formulas) */}
          {onToggleEntitiesDrawer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleEntitiesDrawer}
                  className={cn(
                    "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                    isEntitiesDrawerOpen
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  aria-label="Toggle academic entities drawer"
                >
                  <Layers className="size-4 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                {isEntitiesDrawerOpen ? "Close Entities (Figures/Tables/Math)" : "Entities (Figures/Tables/Math)"}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-3.5 bg-border mx-1" />

          {/* Previous Page ‹ */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onNavigateToPage(Math.max(1, visiblePage - 1))}
                disabled={visiblePage <= 1}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Previous page</TooltipContent>
          </Tooltip>

          {/* Page input / total [ 3 ] / 18 */}
          <Form {...pageNavForm}>
            <form onSubmit={handleSubmit(handlePageSubmit)} className="flex items-center gap-1 font-mono text-11">
              <input
                type="number"
                min={1}
                max={numPages || 1}
                {...register('page', { valueAsNumber: true })}
                onBlur={handleSubmit(handlePageSubmit)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    reset({ page: visiblePage });
                    e.currentTarget.blur();
                  }
                }}
                className="w-9 h-6 text-center text-11 font-mono rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Current page number"
              />
              <span className="text-muted-foreground text-11">/</span>
              <span className="text-muted-foreground min-w-[14px] text-11 tabular-nums">{numPages || 1}</span>
            </form>
          </Form>

          {/* Next Page › */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onNavigateToPage(Math.min(numPages || 1, visiblePage + 1))}
                disabled={visiblePage >= (numPages || 1)}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Next page</TooltipContent>
          </Tooltip>
        </div>

        {/* ── CỤM GIỮA: Chú thích & Bảng màu nhanh (Annotation & Color) ────────── */}
        <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md border border-border shrink-0">
          {/* Mode toggle: Pointer vs Hand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectInteractionMode?.('select')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  interactionMode === 'select'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Text selection mode"
              >
                <MousePointer className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Select Text</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectInteractionMode?.('hand')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  interactionMode === 'hand'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Hand / Pan mode"
              >
                <Hand className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Hand Tool (Pan)</TooltipContent>
          </Tooltip>

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {/* 1. Highlight Text */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('highlight')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer relative",
                  activeTool === 'highlight'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Highlight text"
              >
                <Highlighter className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span
                  className="absolute bottom-1 w-3 h-0.5 rounded-full"
                  style={{ backgroundColor: activeColor }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Highlight (H)</TooltipContent>
          </Tooltip>

          {/* 2. Underline Text */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('underline')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'underline'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Underline text"
              >
                <Underline className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Underline (U)</TooltipContent>
          </Tooltip>

          {/* 3. Sticky Note */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('note')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'note'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Add sticky note"
              >
                <StickyNote className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Add Note (N)</TooltipContent>
          </Tooltip>

          {/* 4. Text Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('text')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'text'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Add text"
              >
                <Type className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Add Text (T)</TooltipContent>
          </Tooltip>

          {/* 5. Area Selection (Figures & Equations) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('area')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'area'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Select area to capture equation or figure"
              >
                <Scan className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Select Area / Figure (A)</TooltipContent>
          </Tooltip>

          {/* 6. Ink / Draw */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('ink')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'ink'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Draw ink"
              >
                <PenTool className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Draw Ink</TooltipContent>
          </Tooltip>

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {/* 7. Quick Color Palette (Top 5 visible + Dropdown for remaining) */}
          <div className="flex items-center gap-1 pl-0.5">
            {ZOTERO_COLORS.slice(0, 5).map((c) => {
              const isSelected = activeColor === c.hex;
              return (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectColor?.(c.hex)}
                      className={cn(
                        "size-4 rounded-full border border-border hover:scale-125 transition-all cursor-pointer",
                        isSelected && "ring-2 ring-primary ring-offset-1 scale-110"
                      )}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Color ${c.label}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-11">{c.label}</TooltipContent>
                </Tooltip>
              );
            })}

            {/* Dropdown for all 8 colors */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-4.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-0.5"
                  aria-label="More colors"
                >
                  <ChevronDown className="size-3" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="p-1.5 flex items-center gap-1 min-w-0 bg-popover border border-border shadow-none rounded-md">
                {ZOTERO_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectColor?.(c.hex)}
                    title={c.label}
                    className={cn(
                      "size-4 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer",
                      activeColor === c.hex && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── CỤM PHẢI: Thu phóng, Xoay, Theme, Tìm kiếm & Inspector ──────────── */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom Out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomOut}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Zoom out"
              >
                <ZoomOut className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Zoom Out</TooltipContent>
          </Tooltip>

          {/* Zoom Preset Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-6 px-1.5 flex items-center gap-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground font-mono text-11 transition-colors cursor-pointer tabular-nums"
                aria-label="Zoom percentage"
              >
                <span>{Math.round(zoom * 100)}%</span>
                <ChevronDown className="size-2.5 opacity-60 shrink-0" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-28 text-xs p-1 bg-popover border border-border shadow-none rounded-md">
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.label}
                  onClick={() => onSetZoom?.(preset.value)}
                  className="cursor-pointer text-11 font-mono flex items-center justify-between tabular-nums"
                >
                  <span>{preset.label}</span>
                  {Math.abs(zoom - preset.value) < 0.05 && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
              ))}
              {onFitWidth && (
                <>
                  <div className="h-px bg-border my-1" />
                  <DropdownMenuItem
                    onClick={onFitWidth}
                    className="cursor-pointer text-11 font-medium"
                  >
                    Fit to Width
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoom In */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomIn}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Zoom in"
              >
                <ZoomIn className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Zoom In</TooltipContent>
          </Tooltip>

          {/* Fit Width */}
          {onFitWidth && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onFitWidth}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Fit to width"
                >
                  <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">Fit to Width</TooltipContent>
            </Tooltip>
          )}

          {/* Rotate Clockwise 90° */}
          {onRotate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRotate}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Rotate clockwise"
                >
                  <RotateCw className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                Rotate 90° ({rotation || 0}°)
              </TooltipContent>
            </Tooltip>
          )}

          {/* Reading Mode Theme Filter (Normal / Sepia / Dark) */}
          {onToggleThemeMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleThemeMode}
                  className={cn(
                    "size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                    themeMode !== 'normal' && "text-primary font-medium"
                  )}
                  aria-label="Toggle reading theme"
                >
                  {themeMode === 'dark' ? (
                    <Moon className="size-3.5 shrink-0" strokeWidth={1.5} />
                  ) : themeMode === 'sepia' ? (
                    <span className="size-3.5 rounded-full bg-[#dfd3b8] border border-border shrink-0" />
                  ) : (
                    <Sun className="size-3.5 shrink-0" strokeWidth={1.5} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                Theme: {themeMode === 'dark' ? 'Dark Mode' : themeMode === 'sepia' ? 'Sepia Paper' : 'Normal'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Search in Document 🔍 */}
          {onToggleSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleSearch}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Find in document"
                >
                  <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">Find in Document (Ctrl+F)</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-3.5 bg-border mx-1" />

          {/* Inspector Panel Toggle [ |] */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInspector}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  isInspectorOpen
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Toggle inspector panel"
              >
                <PanelRight className="size-4 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              {isInspectorOpen ? "Close panel (Ctrl+/)" : "Open panel (Ctrl+/)"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

export default ReaderToolbar;
