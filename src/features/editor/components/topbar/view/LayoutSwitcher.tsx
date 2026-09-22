'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Columns2,
  PenLine,
  FileText,
  ExternalLink,
  Maximize2,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore, useCompileStore } from '@/features/editor/store';

export default function LayoutSwitcher() {
  const { layout, setLayout } = useSettingsStore();
  const { pdfUrl, setIsViewerPoppedOut } = useCompileStore();
  const params = useParams<{ projectId?: string; pageId?: string }>();

  const handleOpenPdfSeparateTab = () => {
    const pageId = params?.pageId;
    if (pageId) {
      const url = params.projectId
        ? `/projects/${params.projectId}/pages/${pageId}/popout`
        : `/editor/${pageId}/popout`;
      window.open(url, '_blank');
      setIsViewerPoppedOut(true);
    } else if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleToggleFocusMode = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcut: Ctrl + Shift + M for Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        handleToggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Layout options"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground transition-colors outline-none cursor-pointer select-none"
        >
          <Columns2 className="size-3.5 shrink-0" />
          <span>Layout</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md text-xs z-[9999]"
      >
        {/* Header */}
        <div className="text-11 font-semibold text-muted-foreground px-2.5 py-1.5 select-none">
          Layout options
        </div>

        {/* 1. Split view */}
        <DropdownMenuItem
          onClick={() => setLayout('split')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-colors',
            layout === 'split'
              ? 'bg-primary text-primary-foreground font-medium focus:bg-primary focus:text-primary-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'split' ? (
              <Check className="size-4 text-primary-foreground stroke-[2.5]" />
            ) : (
              <Columns2 className="size-4 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs">Split view</span>
        </DropdownMenuItem>

        {/* 2. Editor only */}
        <DropdownMenuItem
          onClick={() => setLayout('editor-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-colors',
            layout === 'editor-only'
              ? 'bg-primary text-primary-foreground font-medium focus:bg-primary focus:text-primary-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'editor-only' ? (
              <Check className="size-4 text-primary-foreground stroke-[2.5]" />
            ) : (
              <PenLine className="size-4 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs">Editor only</span>
        </DropdownMenuItem>

        {/* 3. PDF only */}
        <DropdownMenuItem
          onClick={() => setLayout('viewer-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-colors',
            layout === 'viewer-only'
              ? 'bg-primary text-primary-foreground font-medium focus:bg-primary focus:text-primary-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'viewer-only' ? (
              <Check className="size-4 text-primary-foreground stroke-[2.5]" />
            ) : (
              <FileText className="size-4 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs">PDF only</span>
        </DropdownMenuItem>

        {/* 4. Open PDF in separate tab */}
        <DropdownMenuItem
          onClick={handleOpenPdfSeparateTab}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors"
        >
          <ExternalLink className="size-4 shrink-0 opacity-70" />
          <span className="flex-1 text-xs">Open PDF in separate tab</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border" />

        {/* 5. Focus mode */}
        <DropdownMenuItem
          onClick={handleToggleFocusMode}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors"
        >
          <Maximize2 className="size-4 shrink-0 opacity-70" />
          <span className="flex-1 text-xs">Focus mode</span>
          <span className="text-10 font-mono px-1 py-0.5 rounded-sm bg-muted border border-border text-muted-foreground">Ctrl Shift M</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
