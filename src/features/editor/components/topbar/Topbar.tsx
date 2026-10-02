'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Home, PanelLeft, History, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Menubar } from "@/shared/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import dynamic from 'next/dynamic';

import FileMenu from './file/FileMenu';
import EditMenu from './edit/EditMenu';
import ViewMenu from './view/ViewMenu';
import InsertMenu from './insert/InsertMenu';
import FormatMenu from './format/FormatMenu';
import LayoutSwitcher from './view/LayoutSwitcher';

const TemplateGalleryModal = dynamic(
  () => import('@/features/editor/components/modals/TemplateGalleryModal'),
  { ssr: false }
);
const KeyboardShortcutsModal = dynamic(
  () => import('@/features/editor/components/modals/KeyboardShortcutsModal'),
  { ssr: false }
);
const QuickOpenModal = dynamic(
  () => import('@/features/editor/components/modals/QuickOpenModal'),
  { ssr: false }
);
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useSettingsStore, useCompileStore, usePageStore } from '@/features/editor/store';
import { usePageActions } from '@/features/editor/hooks/use-core';
import { cn } from '@/shared/lib/utils';

export default function Topbar() {
  const params = useParams<{ projectId?: string }>();
  const homeHref = params?.projectId ? `/projects/${params.projectId}` : '/projects';
  const {
    toggleHistory,
    isHistoryOpen,
    isTemplateModalOpen,
  } = useSettingsStore();
  const { dirtyContentMap } = useCompileStore();
  const { updateTitle: updateTitleMutation } = usePageActions();

  const isSaving = dirtyContentMap.size > 0 || updateTitleMutation.isPending;

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+P or Cmd+P -> Quick Open
      if (modKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen((prev) => !prev);
        return;
      }

      // Ctrl+/ or Cmd+/ or F1 -> Keyboard shortcuts cheat sheet
      if ((modKey && e.key === '/') || (e.key === 'F1' && !e.shiftKey && !e.altKey)) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <nav
      aria-label="Editor toolbar"
      className="flex h-11 items-center justify-between gap-2 px-3 py-1 bg-muted border-b border-border shrink-0 z-10 select-none"
    >
      {/* ── Left: Logo (Back to project / Home), Main Menubar ── */}
      <div className="flex items-center min-w-0 shrink-0 gap-1">
        {/* Mobile sidebar drawer trigger */}
        <button
          type="button"
          onClick={() => EditorEventBus.emit('flux:toggle-sidebar')}
          title="Open Explorer & Tools"
          aria-label="Open Explorer & Tools"
          className="md:hidden flex items-center justify-center p-1.5 rounded-sm text-foreground hover:bg-sidebar-hover transition-colors mr-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <PanelLeft className="size-4 shrink-0" />
        </button>

        <TooltipProvider delayDuration={150}>
          {/* Single Logo button: click to go back to project, hover transforms to Home icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                aria-label="Back to your project"
                className="group relative flex size-8 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 cursor-pointer"
              >
                <img
                  src="/Flux.svg"
                  className="size-5 shrink-0 transition-opacity duration-150 group-hover:opacity-0"
                  alt="Flux"
                />
                <Home
                  className="size-4 shrink-0 text-foreground transition-opacity duration-150 absolute opacity-0 group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Back to your project
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Menubar className="h-8 border-none bg-transparent p-0 gap-0.5 shadow-none">
          {/* Sub-menu Tabs */}
          <FileMenu />
          <EditMenu />
          <InsertMenu />
          <ViewMenu />
          <FormatMenu />
        </Menubar>
      </div>

      {/* ── Right: Save Status, Review, History, Quick Layout Switcher & Settings Trigger ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Save Status Indicator: only show when actively saving */}
        {isSaving && (
          <div className="flex items-center shrink-0 mr-0.5">
            <span
              className="flex items-center gap-1 text-11 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full select-none"
              title="Saving..."
            >
              <Loader2 className="size-3 animate-spin shrink-0" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          </div>
        )}


        <button
          type="button"
          onClick={toggleHistory}
          title="History (Revisions)"
          aria-label="History"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none select-none",
            isHistoryOpen
              ? "bg-background text-foreground font-semibold"
              : "text-foreground/80 hover:text-foreground hover:bg-sidebar-hover"
          )}
        >
          <History className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">History</span>
        </button>

        <LayoutSwitcher />

        {isTemplateModalOpen && <TemplateGalleryModal />}
        {isShortcutsOpen && (
          <KeyboardShortcutsModal
            open={isShortcutsOpen}
            onOpenChange={setIsShortcutsOpen}
          />
        )}
        {isQuickOpenOpen && (
          <QuickOpenModal
            open={isQuickOpenOpen}
            onOpenChange={setIsQuickOpenOpen}
          />
        )}
      </div>
    </nav>
  );
}
