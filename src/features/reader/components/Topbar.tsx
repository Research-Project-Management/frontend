'use client';

import React, { useState, useEffect } from 'react';
import {
  Library,
  FileText,
  X,
  Printer,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { ReaderDocument } from '../types/reader.types';
import type { ReaderTab } from '../store/reader.store';

export interface TopbarProps {
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

export function Topbar({
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
  const libraryTitle = scopeTitle || 'My Library';
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // If tabs are empty or missing, fallback to single active tab representation
  const effectiveTabs: ReaderTab[] = tabs.length > 0
    ? tabs.map((t) =>
        t.id === 'library' || t.type === 'library'
          ? { ...t, title: libraryTitle }
          : t,
      )
    : [
        { id: 'library', title: libraryTitle, type: 'library' },
        ...(paper ? [{ id: paper.id, title: paper.title || 'Untitled Document', type: 'paper' as const }] : []),
      ];

  const currentTabId = activeTabId || (paper ? paper.id : 'library');
  const isDocumentActive = currentTabId !== 'library';

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
          const isLibrary = tab.id === 'library' || tab.type === 'library';

          if (isLibrary) {
            const tabTitle = tab.title || libraryTitle;
            return (
              <button
                key="library"
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (onSelectTab) onSelectTab('library');
                  else if (onBack) onBack();
                }}
                className={cn(
                  "h-8 px-3 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1 md:before:hidden",
                  isActive
                    ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                    : "text-foreground hover:bg-muted"
                )}
                title={tabTitle}
              >
                <Library className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
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
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTab?.(tab.id);
                }
              }}
              className={cn(
                "h-8 px-2.5 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 max-w-[240px] group outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                  : "text-foreground hover:bg-muted"
              )}
              title={tab.title}
            >
              <FileText className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              <span className="truncate flex-1 font-medium">{tab.title || 'Untitled Document'}</span>
              
              {onCloseTab && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={cn(
                    "size-4 flex items-center justify-center rounded-sm hover:bg-muted text-foreground transition-all cursor-pointer shrink-0 relative before:absolute before:-inset-2.5 md:before:hidden",
                    isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100 max-md:opacity-100"
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
}

export default Topbar;
