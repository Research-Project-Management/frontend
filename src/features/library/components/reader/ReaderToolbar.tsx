'use client';

import React, { useState, useEffect } from 'react';
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
  Sun,
  Moon,
  Hand,
  MousePointer,
  Check,
  Undo2,
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
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type { ReaderAnnotationTool } from '@/features/library/store/reader.store';

export interface ReaderToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePage: number;
  numPages: number;
  onNavigateToPage: (page: number) => void;
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;
  interactionMode?: 'select' | 'hand';
  onSelectInteractionMode?: (mode: 'select' | 'hand') => void;
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
  viewMode?: 'single' | 'continuous' | 'spread';
  onSelectViewMode?: (mode: 'single' | 'continuous' | 'spread') => void;
  fitMode?: 'fit-width' | 'fit-page' | 'auto';
  onSelectFitMode?: (mode: 'fit-width' | 'fit-page' | 'auto') => void;
  themeMode?: 'normal' | 'dark' | 'sepia' | 'invert';
  onToggleThemeMode?: () => void;
  splitMode?: 'none' | 'horizontal' | 'vertical';
  onSelectSplitMode?: (mode: 'none' | 'horizontal' | 'vertical') => void;
  onToggleSearch?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isScanned?: boolean;
  ocrStatus?: 'pending' | 'processing' | 'ready' | 'completed' | 'none';
  onTriggerOcr?: () => void;
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
] as const;

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
] as const;

const ANNOTATION_TOOLS: Array<{
  id: ReaderAnnotationTool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'highlight', label: 'Highlight text', shortcut: 'Highlight (Alt+1)', icon: Highlighter },
  { id: 'underline', label: 'Underline text', shortcut: 'Underline (Alt+2)', icon: Underline },
  { id: 'note', label: 'Add note', shortcut: 'Add Note (Alt+3)', icon: StickyNote },
  { id: 'text', label: 'Add text', shortcut: 'Add Text (Alt+4)', icon: Type },
  { id: 'area', label: 'Select area / image', shortcut: 'Select Area / Image (Alt+5)', icon: Scan },
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
            'size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent',
            active
              ? 'bg-background text-foreground font-medium border border-border/50'
              : 'text-foreground hover:bg-muted',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

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
  splitMode = 'none',
  onSelectSplitMode,
  onToggleSearch,
  isInspectorOpen,
  onToggleInspector,
  isScanned = false,
  ocrStatus = 'none',
  onTriggerOcr,
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState<string>(String(visiblePage));

  useEffect(() => {
    setPageInput(String(visiblePage));
  }, [visiblePage]);

  // Zotero 7 official keyboard shortcuts
  useEffect(() => {
    const colorOrder = ZOTERO_COLORS.map((c) => c.hex);

    const handleToolShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigateBack?.();
        return;
      }

      if (e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      if (!e.altKey && key === 's') {
        e.preventDefault();
        onSelectInteractionMode?.('select');
        return;
      }
      if (!e.altKey && key === 'h') {
        e.preventDefault();
        onSelectInteractionMode?.('hand');
        return;
      }

      if (e.altKey) {
        const toolMap: Record<string, ReaderAnnotationTool> = {
          '1': 'highlight',
          '2': 'underline',
          '3': 'note',
          '4': 'text',
          '5': 'area',
        };
        if (key in toolMap) {
          e.preventDefault();
          onSelectTool?.(toolMap[key]);
        } else if (key === '8' && onSelectColor) {
          e.preventDefault();
          const currentIdx = colorOrder.indexOf((activeColor || '#ffd400') as (typeof colorOrder)[number]);
          const nextIdx = (currentIdx + 1) % colorOrder.length;
          onSelectColor(colorOrder[nextIdx]);
        }
      } else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
        e.preventDefault();
        const colorIdx = parseInt(key, 10) - 1;
        if (colorIdx >= 0 && colorIdx < colorOrder.length) {
          onSelectColor?.(colorOrder[colorIdx]);
        }
      }
    };

    window.addEventListener('keydown', handleToolShortcuts);
    return () => window.removeEventListener('keydown', handleToolShortcuts);
  }, [onSelectTool, onNavigateBack, onSelectInteractionMode, onSelectColor, activeColor]);

  const commitPageInput = () => {
    const p = parseInt(pageInput.trim(), 10);
    if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
      if (p !== visiblePage) onNavigateToPage(p);
    } else {
      setPageInput(String(visiblePage));
    }
  };

  return (
    <div className="min-h-10 h-10 shrink-0 border-b border-border bg-background px-2 flex items-center justify-between select-none z-20 text-xs overflow-x-auto min-w-0 thin-scrollbar gap-2">
      {/* ── LEFT CLUSTER: Sidebar toggle | Back | Page Navigation ── */}
        <div className="flex items-center gap-1 shrink-0">
          <ToolbarIconButton
            onClick={onToggleSidebar}
            active={isSidebarOpen}
            ariaLabel="Toggle navigation sidebar"
            tooltip={isSidebarOpen ? 'Close sidebar (Ctrl+\\)' : 'Open sidebar (Ctrl+\\)'}
            className={isSidebarOpen ? 'bg-muted border-none' : undefined}
          >
            <PanelLeft className="size-4 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>

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

          <ToolbarIconButton
            onClick={() => onNavigateToPage(Math.max(1, visiblePage - 1))}
            disabled={visiblePage <= 1}
            ariaLabel="Previous page"
            tooltip="Previous page (PageUp)"
          >
            <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitPageInput();
            }}
            className="flex items-center gap-1 font-mono text-11"
          >
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setPageInput(String(visiblePage));
                  e.currentTarget.blur();
                }
              }}
              className="w-9 h-6 text-center text-11 font-mono rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Current page number"
            />
            <span className="text-foreground text-11 font-mono">/</span>
            <span className="text-foreground min-w-[14px] text-11 font-mono tabular-nums">
              {numPages || 1}
            </span>
          </form>

          <ToolbarIconButton
            onClick={() => onNavigateToPage(Math.min(numPages || 1, visiblePage + 1))}
            disabled={visiblePage >= (numPages || 1)}
            ariaLabel="Next page"
            tooltip="Next page (PageDown)"
          >
            <ChevronRight className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>
        </div>

        {/* ── CENTER CLUSTER: Annotation & Quick Color Palette ── */}
        <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md border border-border shrink-0">
          <ToolbarIconButton
            onClick={() => onSelectInteractionMode?.('select')}
            active={interactionMode === 'select'}
            ariaLabel="Text selection mode"
            tooltip="Select (S)"
          >
            <MousePointer className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>

          <ToolbarIconButton
            onClick={() => onSelectInteractionMode?.('hand')}
            active={interactionMode === 'hand'}
            ariaLabel="Hand / Pan mode"
            tooltip="Hand (H)"
          >
            <Hand className="size-3.5 shrink-0" strokeWidth={1.5} />
          </ToolbarIconButton>

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {ANNOTATION_TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
            <ToolbarIconButton
              key={id}
              onClick={() => onSelectTool?.(id)}
              active={activeTool === id}
              ariaLabel={label}
              tooltip={shortcut}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
              {id === 'highlight' && (
                <span
                  className="absolute bottom-1 w-3 h-0.5 rounded-full"
                  style={{ backgroundColor: activeColor }}
                />
              )}
            </ToolbarIconButton>
          ))}

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {/* Quick Color Palette (Top 5 visible + Dropdown for all 8) */}
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
                        'size-4 rounded-full border border-border hover:scale-125 transition-all cursor-pointer relative before:absolute before:-inset-2.5 md:before:hidden',
                        isSelected && 'ring-2 ring-primary ring-offset-1 scale-110',
                      )}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Color ${c.label}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {c.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-6 flex items-center justify-center rounded hover:bg-muted text-foreground transition-colors cursor-pointer ml-0.5 relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="More colors"
                >
                  <ChevronDown className="size-3" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="p-1.5 flex items-center gap-1 min-w-0 bg-popover border border-border shadow-raised-200 rounded-md z-50"
              >
                {ZOTERO_COLORS.map((c) => (
                  <Tooltip key={c.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectColor?.(c.hex)}
                        aria-label={`Color ${c.label}`}
                        className={cn(
                          'size-4 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer relative before:absolute before:-inset-2 md:before:hidden',
                          activeColor === c.hex && 'ring-2 ring-primary ring-offset-1',
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{c.label}</TooltipContent>
                  </Tooltip>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {onToggleToolLocked && (
              <ToolbarIconButton
                onClick={onToggleToolLocked}
                active={isToolLocked}
                ariaLabel={isToolLocked ? 'Unlock tool' : 'Lock tool'}
                tooltip={
                  isToolLocked
                    ? 'Tool Locked (Tool stays active after use)'
                    : 'Lock Tool (Stay active)'
                }
                className={
                  isToolLocked
                    ? 'ml-0.5 bg-primary/10 text-primary border border-primary/20'
                    : 'ml-0.5'
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
        </div>

        {/* ── RIGHT CLUSTER: Zoom | Presentation Mode | Appearance & Rotate & Split | Find & Inspector ── */}
        <div className="flex items-center gap-1 shrink-0">
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
                className="h-7 px-2 flex items-center gap-1 rounded-md hover:bg-muted text-foreground font-mono text-11 transition-colors cursor-pointer tabular-nums relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Zoom percentage"
              >
                <span>{Math.round(zoom * 100)}%</span>
                <ChevronDown className="size-2.5 opacity-60 shrink-0" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="w-28 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50"
            >
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.label}
                  onClick={() => onSetZoom?.(preset.value)}
                  className="cursor-pointer text-11 font-mono flex items-center justify-between tabular-nums"
                >
                  <span>{preset.label}</span>
                  {Math.abs(zoom - preset.value) < 0.05 && (
                    <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                  )}
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
                onSelectFitMode?.('fit-width');
                onFitWidth();
              }}
              ariaLabel="Fit to width"
              tooltip="Fit to Width"
            >
              <Maximize2 className="size-3.5 shrink-0" strokeWidth={1.5} />
            </ToolbarIconButton>
          )}

          {(onSelectViewMode || onSelectFitMode) && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-7 px-2 flex items-center gap-1 rounded-md hover:bg-muted text-foreground text-11 transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      aria-label="Page presentation mode"
                    >
                      <span className="capitalize text-11 font-sans">
                        {viewMode === 'spread' ? 'Spread' : viewMode === 'single' ? 'Single' : 'Scroll'}
                      </span>
                      <ChevronDown className="size-2.5 opacity-60 shrink-0" strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Page Presentation
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="center"
                className="w-44 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50"
              >
                {([
                  ['continuous', 'Continuous Scroll'],
                  ['single', 'Single Page'],
                  ['spread', 'Two Pages (Spread)'],
                ] as const).map(([mode, label]) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => onSelectViewMode?.(mode)}
                    className="cursor-pointer text-11 flex items-center justify-between"
                  >
                    <span>{label}</span>
                    {viewMode === mode && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onSelectFitMode?.('fit-width');
                    onFitWidth?.();
                  }}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Fit to Width</span>
                  {fitMode === 'fit-width' && (
                    <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSelectFitMode?.('fit-page')}
                  className="cursor-pointer text-11 flex items-center justify-between"
                >
                  <span>Fit to Page</span>
                  {fitMode === 'fit-page' && (
                    <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {onRotate && (
            <ToolbarIconButton
              onClick={onRotate}
              ariaLabel="Rotate clockwise"
              tooltip={`Rotate 90° (${rotation || 0}°)`}
            >
              <RotateCw className="size-3.5 shrink-0" strokeWidth={1.5} />
            </ToolbarIconButton>
          )}

          {onToggleThemeMode && (
            <ToolbarIconButton
              onClick={onToggleThemeMode}
              ariaLabel="Toggle reading appearance theme"
              tooltip={`Appearance: ${
                themeMode === 'dark' ? 'Dark Mode' : themeMode === 'sepia' ? 'Sepia Paper' : 'Normal'
              }`}
              className={themeMode !== 'normal' ? 'text-primary font-medium' : undefined}
            >
              {themeMode === 'dark' ? (
                <Moon className="size-3.5 shrink-0" strokeWidth={1.5} />
              ) : themeMode === 'sepia' ? (
                <span className="size-3.5 rounded-full bg-[#dfd3b8] border border-border shrink-0" />
              ) : (
                <Sun className="size-3.5 shrink-0" strokeWidth={1.5} />
              )}
            </ToolbarIconButton>
          )}

          {onSelectSplitMode && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        splitMode && splitMode !== 'none' && 'bg-muted text-primary font-medium',
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
                <TooltipContent side="bottom">
                  Split View (
                  {splitMode === 'vertical'
                    ? 'Vertical'
                    : splitMode === 'horizontal'
                      ? 'Horizontal'
                      : 'Single'}
                  )
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-36 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50"
              >
                {([
                  ['none', 'Single View', Square],
                  ['vertical', 'Split Vertical', Columns2],
                  ['horizontal', 'Split Horizontal', Rows2],
                ] as const).map(([mode, label, Icon]) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => onSelectSplitMode(mode)}
                    className="cursor-pointer text-11 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-3.5" strokeWidth={1.5} /> {label}
                    </span>
                    {(splitMode || 'none') === mode && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isScanned && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onTriggerOcr}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning text-10 font-medium select-none cursor-pointer transition-colors hover:bg-warning/20 relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Scanned document OCR indicator"
                >
                  <Scan className="size-3 text-warning shrink-0" strokeWidth={1.5} />
                  <span>{ocrStatus === 'processing' ? 'OCR Running...' : 'Scanned PDF'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {ocrStatus === 'processing'
                  ? 'Optical character recognition is processing text layer'
                  : 'Document is image-based (no native text layer). Text layer ready via OCR.'}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {onToggleSearch && (
            <ToolbarIconButton
              onClick={onToggleSearch}
              ariaLabel="Find in document"
              tooltip="Find in Document (Ctrl+F)"
            >
              <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
            </ToolbarIconButton>
          )}

          {onToggleInspector && !isInspectorOpen && (
            <>
              <div className="w-px h-3.5 bg-border mx-0.5" />
              <ToolbarIconButton
                onClick={onToggleInspector}
                ariaLabel="Expand inspector"
                tooltip="Expand inspector (Ctrl+/)"
              >
                <PanelRight className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              </ToolbarIconButton>
            </>
          )}
        </div>
    </div>
  );
}

export default ReaderToolbar;
