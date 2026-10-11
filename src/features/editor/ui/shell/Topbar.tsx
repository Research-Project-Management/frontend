'use client';

/**
 * Topbar.tsx
 *
 * Topbar & Menubar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/Topbar.tsx`
 *
 * Layout:
 * - Left: Back to Projects / Logo, Menubar (File, Edit, Insert, View, Format).
 * - Center: Project Title (click to rename / dropdown).
 * - Right: Saving status, History button, Layout switcher, Collaborator avatars.
 *
 * (Note: Settings is hosted in the left ActivityBar icon; Mode switcher is located at top-left of Editor Pane).
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  History,
  Loader2,
  PanelLeft,
  Home,
  Cloud,
} from 'lucide-react';
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

import FileMenu from './topbar/FileMenu';
import EditMenu from './topbar/EditMenu';
import ViewMenu from './topbar/ViewMenu';
import LayoutSwitcher from './topbar/LayoutSwitcher';
import ProjectTitleDropdown from './topbar/ProjectTitleDropdown';
import CollaboratorAvatarStack from './topbar/CollaboratorAvatarStack';
import EditingModeDropdown from './topbar/EditingModeDropdown';

import { editorCommandBus } from '../../coordinators/command-bus';
import { sessionCoordinator } from '../../coordinators/session.coordinator';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { usePageActions } from '../hooks/use-page-actions';
import { extractProjectId } from '@/features/editor/domain/types/core.types';

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
  const storeProjectId = usePageStore(
    (s) => s.projectId || extractProjectId(s.currentPage) || '',
  );
  const effectiveProjectId = params?.projectId || storeProjectId;
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

  const handleToggleHistory = useCallback(async () => {
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
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isEditorFocused =
          activeEl?.classList.contains('cm-content') ||
          Boolean(activeEl?.closest('.cm-editor') || activeEl?.closest('.ProseMirror'));

        if (modKey && e.key === '/' && isEditorFocused) {
          return;
        }

        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+V -> Toggle Source vs Visual mode
      if (modKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        useSettingsStore.getState().toggleEditorMode();
        return;
      }
    };

    const unsubOpen = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'quick-open') {
        setIsQuickOpenOpen(true);
      } else if (cmd.dialog === 'shortcuts') {
        setIsShortcutsOpen(true);
      }
    });

    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'quick-open') {
        setIsQuickOpenOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'shortcuts') {
        setIsShortcutsOpen(false);
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubOpen();
      unsubClose();
    };
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Editor toolbar"
        className="relative flex h-10 items-center justify-between gap-2 px-2.5 py-0.5 bg-sidebar shrink-0 z-30 select-none"
      >
        {/* ── Left: Back / Logo, Full Menubar ── */}
        <div className="flex items-center min-w-0 shrink-0 gap-1.5">
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

          {/* Logo / Back to Projects */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                aria-label="Back to Projects"
                className="group relative flex size-7 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 cursor-pointer"
              >
                <img
                  src="/Flux.svg"
                  className="size-4.5 shrink-0 transition-opacity duration-150 group-hover:opacity-0"
                  alt="Flux"
                />
                <Home
                  className="size-3.5 shrink-0 text-foreground transition-opacity duration-150 absolute opacity-0 group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Back to Projects
            </TooltipContent>
          </Tooltip>

          {/* Desktop Menubar (Overleaf Parity: File, Edit, View) */}
          <Menubar className="h-7 border-none bg-transparent p-0 gap-0.5 shadow-none hidden sm:flex text-12">
            <FileMenu />
            <EditMenu />
            <ViewMenu />
          </Menubar>
        </div>

        {/* ── Center: Project Title Dropdown ── */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center max-w-[180px] sm:max-w-[280px] md:max-w-[380px] lg:max-w-[480px] pointer-events-auto">
          <ProjectTitleDropdown />
        </div>

        {/* ── Right: Save Status, History, Layout, Collaborators ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Save Status Indicator (Overleaf Parity) */}
          {isSaving ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground mr-0.5 select-none"
                  aria-label="Saving changes"
                >
                  <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0 motion-reduce:animate-none" />
                  <span className="hidden xl:inline text-11 font-medium">Saving…</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Saving changes...
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground/60 mr-0.5 select-none cursor-default"
                  aria-label="All changes saved"
                >
                  <Cloud className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="hidden xl:inline text-11 font-normal text-muted-foreground/60">Saved</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                All changes saved to cloud
              </TooltipContent>
            </Tooltip>
          )}

          {/* Editing Mode Dropdown (Overleaf Parity: Editing vs Reviewing vs Viewing) */}
          <EditingModeDropdown />

          {/* History Button (Overleaf Parity: Top Right) */}
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

          {/* Layout Switcher (Overleaf Parity: Top Right) */}
          <LayoutSwitcher />

          {/* Collaborator Presence Avatar Stack */}
          <CollaboratorAvatarStack />

          {/* Global Modals */}
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
