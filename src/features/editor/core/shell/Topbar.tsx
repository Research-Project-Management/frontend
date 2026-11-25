'use client';

/**
 * Topbar.tsx
 *
 * Topbar & Menubar (Block 7: UI Shell Layer).
 * Location: `features/editor/core/shell/Topbar.tsx`
 *
 * Layout:
 * - Left: Back to Projects / Logo, Menubar (File, Edit, Insert, View, Format).
 * - Center: Project Title (click to rename / dropdown).
 * - Right: Saving status, History button, Layout switcher, Collaborator avatars.
 *
 * (Note: Settings is hosted in the left ActivityBar icon; Mode switcher is located at top-left of Editor Pane).
 */

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  History,
  PanelLeft,
  Home,
  ExternalLink,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { Menubar } from "@/shared/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from '@/shared/lib/utils';

import FileMenu from './topbar/FileMenu';
import EditMenu from './topbar/EditMenu';
import InsertMenu from './topbar/InsertMenu';
import ViewMenu from './topbar/ViewMenu';
import FormatMenu from './topbar/FormatMenu';
import HelpMenu from './topbar/HelpMenu';
import LayoutSwitcher from './topbar/LayoutSwitcher';
import ProjectTitleDropdown from './topbar/ProjectTitleDropdown';
import CollaboratorAvatarStack from './topbar/CollaboratorAvatarStack';

import { editorCommandBus } from '../bus/command-bus';
import { sessionCoordinator } from '../coordinator/session.coordinator';
import { useSettingsStore } from '../store/settings.store';
import { usePageStore } from '../store/editor.store';
import { useWorkspaceStore } from '../store/workspace.store';

export function Topbar() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const routeProjectId = params?.projectId as string | undefined;
  const isPersonalPage = !routeProjectId || routeProjectId === 'personal';
  const homeHref = isPersonalPage
    ? '/pages'
    : `/projects/${routeProjectId}/pages`;

  const {
    toggleHistory,
    isHistoryOpen,
  } = useSettingsStore(
    useShallow((s) => ({
      toggleHistory: s.toggleHistory,
      isHistoryOpen: s.isHistoryOpen,
    }))
  );

  const isPdfDetached = useWorkspaceStore((s) => s.isPdfDetached);

  const handleToggleHistory = useCallback(async () => {
    if (!isHistoryOpen) {
      await sessionCoordinator.flushAllPending();
    }
    toggleHistory();
  }, [isHistoryOpen, toggleHistory]);

  return (
      <nav
        aria-label="Editor toolbar"
        className="relative flex h-10 items-center justify-between gap-2 px-2.5 py-0.5 bg-background border-b border-border shrink-0 z-30 select-none"
      >
        {/* ── Left: Back / Logo, Full Menubar ── */}
        <div className="flex items-center min-w-0 shrink-0 gap-1.5">
          {/* Mobile sidebar drawer trigger */}
          <button
            type="button"
            onClick={() => editorCommandBus.dispatch({ type: 'sidebar:toggle-panel', panel: 'Files' })}
            title="Open Explorer & Tools"
            aria-label="Open Explorer & Tools"
            className="md:hidden relative flex items-center justify-center p-1.5 rounded-md text-foreground hover:bg-sidebar-hover transition-colors mr-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:-inset-1.5 after:content-['']"
          >
            <PanelLeft className="size-4 shrink-0" />
          </button>

          {/* Logo / Back to Projects */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                aria-label="Back to Projects"
                className="group relative flex size-7 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 cursor-pointer"
              >
                <img
                  src="/Flux.svg"
                  width={18}
                  height={18}
                  className="size-4.5 shrink-0 transition-opacity duration-150 group-hover:opacity-0"
                  alt="Flux"
                />
                <Home
                  className="size-3.5 shrink-0 text-foreground transition-opacity duration-150 absolute opacity-0 group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              Back to Projects
            </TooltipContent>
          </Tooltip>

          {/* Desktop Menubar (Overleaf Parity: File, Edit, Insert, View, Format, Help) */}
          <Menubar className="h-7 border-none bg-transparent p-0 gap-0.5 shadow-none hidden sm:flex text-12">
            <FileMenu />
            <EditMenu />
            <InsertMenu />
            <ViewMenu />
            <FormatMenu />
            <HelpMenu />
          </Menubar>
        </div>

        {/* ── Center: Project Title Dropdown ── */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center max-w-[180px] sm:max-w-[280px] md:max-w-[380px] lg:max-w-[480px] pointer-events-auto">
          <ProjectTitleDropdown />
        </div>

        {/* ── Right: Collaborators, History, Layout ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Collaborator Presence Avatar Stack (Overleaf Parity: Before Action Buttons) */}
          <CollaboratorAvatarStack />

          {/* History Button (Overleaf Parity: Top Right) */}
          <button
            type="button"
            onClick={handleToggleHistory}
            aria-label="History (revisions)"
            className={cn(
              "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none",
              isHistoryOpen
                ? "bg-background text-foreground font-semibold"
                : "text-foreground/80 hover:text-foreground hover:bg-sidebar-hover"
            )}
          >
            <History className="size-3.5 shrink-0" />
            <span>History</span>
          </button>

          {/* Re-attach PDF Button (Visible when preview is detached to separate tab) */}
          {isPdfDetached && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => editorCommandBus.dispatch({ type: 'preview:attach' })}
                  aria-label="Re-attach PDF to editor"
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none"
                >
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="hidden md:inline">Re-attach PDF</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                Re-attach PDF preview
              </TooltipContent>
            </Tooltip>
          )}

          {/* Layout Switcher (Overleaf Parity: Top Right) */}
          <LayoutSwitcher />
        </div>
      </nav>
  );
}

export default Topbar;
