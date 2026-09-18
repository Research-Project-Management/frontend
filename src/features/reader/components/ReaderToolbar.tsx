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
  Strikethrough,
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
  FileText,
  Undo2,
  BookOpen,
  Lock,
  Unlock,
  Columns2,
  Rows2,
  Square,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

  // History Navigation (Zotero Navigate Back)
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;

  // Interaction Mode (Select vs Hand)
  interactionMode?: 'select' | 'hand';
  onSelectInteractionMode?: (mode: 'select' | 'hand') => void;

  // Active Tool & Color
  activeTool?: ReaderAnnotationTool;
  onSelectTool?: (tool: ReaderAnnotationTool) => void;
  activeColor?: string;
  onSelectColor?: (hex: string) => void;
  isToolLocked?: boolean;
  onToggleToolLocked?: () => void;

  // Zoom & View
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom?: (zoom: number) => void;
  onFitWidth?: () => void;
  rotation?: number;
  onRotate?: () => void;
  // Presentation Mode & Page Fit (Zotero 7: Continuous, Single, Spread)
  viewMode?: 'single' | 'continuous' | 'spread';
  onSelectViewMode?: (mode: 'single' | 'continuous' | 'spread') => void;
  fitMode?: 'fit-width' | 'fit-page' | 'auto';
  onSelectFitMode?: (mode: 'fit-width' | 'fit-page' | 'auto') => void;
  themeMode?: 'normal' | 'dark' | 'sepia' | 'invert';
  onToggleThemeMode?: () => void;

  // Reading Mode & Split View (Zotero Features)
  isReadingMode?: boolean;
  onToggleReadingMode?: () => void;
  splitMode?: 'none' | 'horizontal' | 'vertical';
  onSelectSplitMode?: (mode: 'none' | 'horizontal' | 'vertical') => void;

  // Search & Inspector & Entities
  onToggleSearch?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isEntitiesDrawerOpen?: boolean;
  onToggleEntitiesDrawer?: () => void;
  onExtractToNote?: () => void;
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
  canNavigateBack = false,
  onNavigateBack,
  interactionMode = 'select',
  onSelectInteractionMode,
  activeTool = 'highlight',
  onSelectTool,
  activeColor = '#ffd400',
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
  themeMode = 'normal',
  onToggleThemeMode,
  viewMode = 'continuous',
  onSelectViewMode,
  fitMode = 'fit-width',
  onSelectFitMode,
  isReadingMode = false,
  onToggleReadingMode,
  splitMode = 'none',
  onSelectSplitMode,
  onToggleSearch,
  isInspectorOpen,
  onToggleInspector,
  isEntitiesDrawerOpen = false,
  onToggleEntitiesDrawer,
  onExtractToNote,
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

  // Zotero-standard quick tool keyboard shortcuts (Alt+1..6 or single keys, Alt+Left for Back)
  useEffect(() => {
    const handleToolShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      // Navigate Back: Alt+Left
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigateBack?.();
        return;
      }

      if (e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === '1' || (e.altKey && key === '1') || key === 'h') {
        e.preventDefault();
        onSelectTool?.('highlight');
      } else if (key === '2' || (e.altKey && key === '2') || key === 'u') {
        e.preventDefault();
        onSelectTool?.('underline');
      } else if (key === 's' || (e.altKey && key === 's')) {
        e.preventDefault();
        onSelectTool?.('strike');
      } else if (key === '3' || (e.altKey && key === '3') || key === 'n') {
        e.preventDefault();
        onSelectTool?.('note');
      } else if (key === '4' || (e.altKey && key === '4') || key === 't') {
        e.preventDefault();
        onSelectTool?.('text');
      } else if (key === '5' || (e.altKey && key === '5') || key === 'a') {
        e.preventDefault();
        onSelectTool?.('area');
      } else if (key === '6' || (e.altKey && key === '6') || key === 'd') {
        e.preventDefault();
        onSelectTool?.('ink');
      }
    };
    window.addEventListener('keydown', handleToolShortcuts);
    return () => window.removeEventListener('keydown', handleToolShortcuts);
  }, [onSelectTool, onNavigateBack]);

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
        {/* ── CỤM 1 (START): Điều hướng tài liệu, Zoom, Reading Mode & Lịch sử ────── */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Sidebar Toggle (Left Sidebar) */}
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

          {/* Academic Entities Drawer Toggle (Figures, Tables, Math) */}
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
                {isEntitiesDrawerOpen ? "Close Entities" : "Entities (Figures/Tables/Math)"}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-3.5 bg-border mx-1" />

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
                  <DropdownMenuSeparator />
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

          {/* Fit to Width */}
          {onFitWidth && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    onSelectFitMode?.('fit-width');
                    onFitWidth();
                  }}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Fit to width"
                >
                  <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">Fit to Width</TooltipContent>
            </Tooltip>
          )}

          {/* Page Presentation Dropdown (Zotero 7: Continuous Scroll, Single Page, Two Pages/Spread, Fit Mode) */}
          {(onSelectViewMode || onSelectFitMode) && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-6 px-1.5 flex items-center gap-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-11 transition-colors cursor-pointer"
                      aria-label="Page presentation mode"
                    >
                      <span className="capitalize text-11 font-sans">
                        {viewMode === 'spread' ? 'Spread' : viewMode === 'single' ? 'Single' : 'Scroll'}
                      </span>
                      <ChevronDown className="size-2.5 opacity-60 shrink-0" strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">Page Presentation</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" className="w-44 text-xs p-1 bg-popover border border-border shadow-none rounded-md">
                <DropdownMenuItem
                  onClick={() => onSelectViewMode?.('continuous')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Continuous Scroll</span>
                  {viewMode === 'continuous' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectViewMode?.('single')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Single Page</span>
                  {viewMode === 'single' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectViewMode?.('spread')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Two Pages (Spread)</span>
                  {viewMode === 'spread' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onSelectFitMode?.('fit-width');
                    onFitWidth?.();
                  }}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Fit to Width</span>
                  {fitMode === 'fit-width' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectFitMode?.('fit-page')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Fit to Page</span>
                  {fitMode === 'fit-page' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Zotero Reading Mode Toggle */}
          {onToggleReadingMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleReadingMode}
                  className={cn(
                    "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                    isReadingMode
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  aria-label="Toggle Reading Mode"
                >
                  <BookOpen className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                {isReadingMode ? "Exit Reading Mode" : "Reading Mode (Clean Text View)"}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-3.5 bg-border mx-1" />

          {/* Zotero Navigate Back button (History stack) */}
          {onNavigateBack && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onNavigateBack}
                  disabled={!canNavigateBack}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  aria-label="Navigate back in document"
                >
                  <Undo2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">Back (Alt+Left)</TooltipContent>
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

          {/* 2.1 Strikethrough Text */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectTool?.('strike')}
                className={cn(
                  "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  activeTool === 'strike'
                    ? "bg-background text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Strikethrough text"
              >
                <Strikethrough className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">Strikethrough (S)</TooltipContent>
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

            {/* Lock Tool Mode (Zotero: Keep tool selected after use) */}
            {onToggleToolLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleToolLocked}
                    className={cn(
                      "size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ml-0.5",
                      isToolLocked
                        ? "bg-primary/10 text-primary border border-primary/20 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    aria-label={isToolLocked ? "Unlock tool" : "Lock tool"}
                  >
                    {isToolLocked ? (
                      <Lock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Unlock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">
                  {isToolLocked ? "Tool Locked (Tool stays active after use)" : "Lock Tool (Stay active)"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 8. Zotero-style 1-click Extract Annotations to Note */}
          {onExtractToNote && (
            <>
              <div className="w-px h-3.5 bg-border mx-0.5" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onExtractToNote}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Add note from annotations"
                  >
                    <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">
                  Add Note from Annotations
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* ── CỤM PHẢI: END (Appearance, Rotate, Split View, Find & Context Pane) ──────────── */}
        <div className="flex items-center gap-1 shrink-0">
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

          {/* Appearance / Theme Mode (Normal / Sepia / Dark) */}
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
                  aria-label="Toggle reading appearance theme"
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
                Appearance: {themeMode === 'dark' ? 'Dark Mode' : themeMode === 'sepia' ? 'Sepia Paper' : 'Normal'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Split View (Zotero Reader: Single, Horizontal, Vertical) */}
          {onSelectSplitMode && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                        splitMode && splitMode !== 'none' && "bg-muted text-primary font-medium"
                      )}
                      aria-label="Split view"
                    >
                      {splitMode === 'vertical' ? (
                        <Columns2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                      ) : splitMode === 'horizontal' ? (
                        <Rows2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                      ) : (
                        <Square className="size-3.5 shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">
                  Split View ({splitMode === 'vertical' ? 'Vertical' : splitMode === 'horizontal' ? 'Horizontal' : 'Single'})
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-36 text-xs p-1 bg-popover border border-border shadow-none rounded-md">
                <DropdownMenuItem
                  onClick={() => onSelectSplitMode('none')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Square className="size-3.5" strokeWidth={1.5} /> Single View
                  </span>
                  {(!splitMode || splitMode === 'none') && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectSplitMode('vertical')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Columns2 className="size-3.5" strokeWidth={1.5} /> Split Vertical
                  </span>
                  {splitMode === 'vertical' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectSplitMode('horizontal')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Rows2 className="size-3.5" strokeWidth={1.5} /> Split Horizontal
                  </span>
                  {splitMode === 'horizontal' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
