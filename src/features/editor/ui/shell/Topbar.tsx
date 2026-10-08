'use client';

/**
 * Topbar.tsx
 *
 * Canonical VS Code / Overleaf Topbar & Menubar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/Topbar.tsx`
 *
 * Slots & Anatomy:
 * - Left: Flux Logo (Home navigation), Menubar (File, Edit, Insert, View, Format).
 * - Center: Project Title & Quick Rename Modal Trigger.
 * - Right: Save Status, History, Layout Switcher, and Global Modals.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Home, PanelLeft, History, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';

import { Menubar } from "@/shared/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from '@/shared/lib/utils';

import FileMenu from './topbar/file/FileMenu';
import EditMenu from './topbar/edit/EditMenu';
import ViewMenu from './topbar/view/ViewMenu';
import InsertMenu from './topbar/insert/InsertMenu';
import FormatMenu from './topbar/format/FormatMenu';
import LayoutSwitcher from './topbar/view/LayoutSwitcher';
import ProjectTitleDropdown from './topbar/ProjectTitleDropdown';
import CollaboratorAvatarStack from './topbar/CollaboratorAvatarStack';

import { editorCommandBus } from '../../coordinators/command-bus';
import { sessionCoordinator } from '../../coordinators/session.coordinator';
import { useSettingsStore, useCompileStore, usePageStore } from '../../store';
import { usePageActions } from '../hooks/use-core';

const TemplateGalleryModal = dynamic(
  () => import('../modals/TemplateGalleryModal'),
  { ssr: false }
);
const KeyboardShortcutsModal = dynamic(
  () => import('../modals/KeyboardShortcutsModal'),
  { ssr: false }
);
const QuickOpenModal = dynamic(
  () => import('../modals/QuickOpenModal'),
  { ssr: false }
);

export function Topbar() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const effectiveProjectId =
    params?.projectId ||
    (typeof (currentPage as any)?.projectId === 'string'
      ? (currentPage as any).projectId
      : (currentPage as any)?.projectId?.id);
  const homeHref = effectiveProjectId
    ? `/projects/${effectiveProjectId}/pages`
    : '/projects';

  const {
    toggleHistory,
    isHistoryOpen,
    isTemplateModalOpen,
  } = useSettingsStore(
    useShallow((s) => ({
      toggleHistory: s.toggleHistory,
      isHistoryOpen: s.isHistoryOpen,
      isTemplateModalOpen: s.isTemplateModalOpen,
    }))
  );

  const hasDirtyFiles = useCompileStore((s) => s.dirtyContentMap.size > 0);
  const { updateTitle: updateTitleMutation } = usePageActions();

  const isSaving = hasDirtyFiles || updateTitleMutation.isPending;

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  const handleToggleHistory = React.useCallback(async () => {
    if (!isHistoryOpen) {
      await sessionCoordinator.flushAllPending();
    }
    toggleHistory();
  }, [isHistoryOpen, toggleHistory]);

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

      // Ctrl+Shift+K or Cmd+Shift+K -> Open Citation Picker
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Editor toolbar"
        className="relative flex h-11 items-center justify-between gap-2 px-3 py-1 bg-sidebar border-b border-border shrink-0 z-10 select-none"
      >
        {/* ── Left: Logo (Back to project / Home), Main Menubar ── */}
        <div className="flex items-center min-w-0 shrink-0 gap-1">
          {/* Mobile sidebar drawer trigger */}
          <button
            type="button"
            onClick={() => editorCommandBus.dispatch({ type: 'sidebar:toggle-panel', panel: 'Files' })}
            title="Open Explorer & Tools"
            aria-label="Open Explorer & Tools"
            className="md:hidden relative flex items-center justify-center p-1.5 rounded-md text-foreground hover:bg-sidebar-hover transition-colors mr-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-['']"
          >
            <PanelLeft className="size-4 shrink-0" />
          </button>

          {/* Single Logo button: click to go back to project, hover transforms to Home icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                aria-label="Back to Pages"
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
              Back to Pages
            </TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border mx-1 shrink-0 hidden sm:block" />

          <Menubar className="h-8 border-none bg-transparent p-0 gap-0.5 shadow-none hidden sm:flex">
            {/* Sub-menu Tabs */}
            <FileMenu />
            <EditMenu />
            <InsertMenu />
            <ViewMenu />
            <FormatMenu />
          </Menubar>
        </div>

        {/* ── Center: Project Title Dropdown ── */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center max-w-[180px] sm:max-w-[280px] md:max-w-[380px] lg:max-w-[480px] pointer-events-auto">
          <ProjectTitleDropdown />
        </div>

        {/* ── Right: Save Status, Share, Review, History, Layout Switcher ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Save Status Indicator: only show when actively saving */}
          {isSaving && (
            <div className="flex items-center shrink-0 mr-0.5">
              <span
                className="flex items-center justify-center size-6 text-warning bg-warning/15 rounded-full select-none"
                title="Saving..."
                aria-label="Saving changes"
              >
                <Loader2 className="size-3 animate-spin shrink-0 motion-reduce:animate-none" />
              </span>
            </div>
          )}

          {/* Collaborator Presence Avatar Stack (Real-time Overleaf Parity) */}
          <CollaboratorAvatarStack />

          {/* History Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleToggleHistory}
                aria-label="History (revisions)"
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none",
                  isHistoryOpen
                    ? "bg-background text-foreground font-semibold"
                    : "text-foreground/80 hover:text-foreground hover:bg-sidebar-hover"
                )}
              >
                <History className="size-3.5 shrink-0" />
                <span>History</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              History (revisions)
            </TooltipContent>
          </Tooltip>

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
    </TooltipProvider>
  );
}

export default Topbar;
