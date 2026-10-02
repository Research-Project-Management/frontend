'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Columns2,
  ExternalLink,
  Scan,
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

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M362.7 19.32c-25-25-65.5-25-90.51 0l-48.43 48.43 138.94 138.95 48.43-48.43c25-25 25-65.5 0-90.51l-48.43-48.44zm-76.86 118.97L41.34 382.79c-4.44 4.44-7.44 10.15-8.68 16.32L.34 499.72c-2.38 10.76 7.29 20.43 18.05 18.05l100.61-32.32c6.17-1.24 11.88-4.24 16.32-8.68l244.5-244.5-138.94-138.94z" />
    </svg>
  );
}

function PdfDocIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6.5v9.5a1.5 1.5 0 0 0 1.5 1.5h8.5" />
      <path d="M6 3a1 1 0 0 1 1-1h6.5l3.5 3.5v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3z" />
      <polyline points="13.5 2 13.5 5.5 17 5.5" />
      <rect
        x="7.5"
        y="8.5"
        width="8"
        height="5"
        rx="0.75"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="11.5"
        y="12.2"
        fill="var(--background)"
        fontSize="3"
        fontWeight="900"
        letterSpacing="-0.2px"
        textAnchor="middle"
        stroke="none"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

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
          <Columns2 className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span>Layout</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md text-xs z-[9999]"
      >
        {/* Header */}
        <div className="text-11 font-semibold text-muted-foreground px-2.5 py-1.5 select-none">
          Layout options
        </div>

        {/* 1. Split view */}
        <DropdownMenuItem
          onClick={() => setLayout('split')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'split'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'split' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <Columns2 className="size-4 opacity-70" strokeWidth={1.8} />
            )}
          </div>
          <span className="flex-1 text-xs">Split view</span>
        </DropdownMenuItem>

        {/* 2. Editor only */}
        <DropdownMenuItem
          onClick={() => setLayout('editor-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'editor-only'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'editor-only' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <PenIcon className="size-3.5 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs">Editor only</span>
        </DropdownMenuItem>

        {/* 3. PDF only */}
        <DropdownMenuItem
          onClick={() => setLayout('viewer-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'viewer-only'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'viewer-only' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <PdfDocIcon className="size-4 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs">PDF only</span>
        </DropdownMenuItem>

        {/* 4. Open PDF in separate tab */}
        <DropdownMenuItem
          onClick={handleOpenPdfSeparateTab}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            <ExternalLink className="size-4 opacity-70" strokeWidth={1.8} />
          </div>
          <span className="flex-1 text-xs">Open PDF in separate tab</span>
        </DropdownMenuItem>

        {/* Divider */}
        <DropdownMenuSeparator className="my-1 bg-border" />

        {/* 5. Focus mode */}
        <DropdownMenuItem
          onClick={handleToggleFocusMode}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            <Scan className="size-4 opacity-70" strokeWidth={1.8} />
          </div>
          <span className="flex-1 text-xs">Focus mode</span>
          <span className="text-11 text-muted-foreground ml-auto">Ctrl Shift M</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
