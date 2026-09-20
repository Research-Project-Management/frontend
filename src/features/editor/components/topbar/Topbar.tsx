'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Home, PanelLeft, History, Users, Check, Loader2, MessageSquareQuote } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Menubar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";

import FileMenu from './file/FileMenu';
import EditMenu from './edit/EditMenu';
import ViewMenu from './view/ViewMenu';
import InsertMenu from './insert/InsertMenu';
import FormatMenu from './format/FormatMenu';
import DocumentBreadcrumb from './breadcrumb/DocumentBreadcrumb';
import LayoutSwitcher from './view/LayoutSwitcher';
import Trigger from './settings/Trigger';
import ShareProjectModal from '@/features/editor/components/modals/ShareProjectModal';
import TemplateGalleryModal from '@/features/editor/components/modals/TemplateGalleryModal';
import KeyboardShortcutsModal from '@/features/editor/components/modals/KeyboardShortcutsModal';
import QuickOpenModal from '@/features/editor/components/modals/QuickOpenModal';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useSettingsStore, useCompileStore, usePageStore } from '@/features/editor/store';
import { usePageActions } from '@/features/editor/hooks/use-core';
import { usePageComments } from '@/features/editor/hooks/use-comment';
import { usePageSuggestions } from '@/features/editor/hooks/use-suggestion';
import { cn } from '@/shared/lib/utils';

export default function Topbar() {
  const params = useParams<{ projectId?: string }>();
  const homeHref = params?.projectId ? `/projects/${params.projectId}` : '/projects';
  const {
    toggleHistory,
    isHistoryOpen,
    setIsShareModalOpen,
    activeSidebarPanel,
    setActiveSidebarPanel,
  } = useSettingsStore();
  const { dirtyContentMap } = useCompileStore();
  const { updateTitle: updateTitleMutation } = usePageActions();
  const queryClient = useQueryClient();

  const activePageId = usePageStore((s) => s.activePageId);
  const currentPage = usePageStore((s) => s.currentPage);
  const pageId = activePageId || currentPage?.id;

  const { data: comments = [] } = usePageComments(pageId ?? null);
  const { data: suggestions = [] } = usePageSuggestions(pageId ?? null, 'pending');

  const openCommentsCount = comments.filter((c) => c.status === 'open').length;
  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;
  const totalReviewItems = openCommentsCount + pendingSuggestionsCount;

  const isReviewOpen = activeSidebarPanel === 'Review';

  const handleToggleReview = () => {
    if (isReviewOpen) {
      setActiveSidebarPanel(null);
    } else {
      setActiveSidebarPanel('Review');
      EditorEventBus.emit('flux:open-panel', 'Review');
    }
  };

  // Realtime updates from Socket.IO room events
  useEffect(() => {
    if (!pageId) return;
    const unsub = EditorEventBus.on('flux:review-event', ({ pageId: evtPageId, event }) => {
      if (evtPageId !== pageId) return;
      if (event.startsWith('comment:') || event.startsWith('comments:')) {
        queryClient.invalidateQueries({ queryKey: ['page-comments', pageId] });
      }
      if (event.startsWith('suggestion:') || event.startsWith('suggestions:')) {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      }
    });
    return () => unsub();
  }, [pageId, queryClient]);

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
      className="flex h-11 items-center justify-between gap-2 px-2 py-1 bg-muted shrink-0 z-10 select-none"
    >
      {/* ── Left: Logo (Back to project / Home), Main Menubar ── */}
      <div className="flex items-center min-w-0 shrink-0 gap-1">
        {/* Mobile sidebar drawer trigger */}
        <button
          type="button"
          onClick={() => EditorEventBus.emit('flux:toggle-sidebar')}
          title="Open Explorer & Tools"
          aria-label="Open Explorer & Tools"
          className="md:hidden flex items-center justify-center p-1.5 rounded text-foreground hover:bg-sidebar-hover transition-colors mr-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                  className="size-5 shrink-0 transition-[opacity,transform] duration-150 group-hover:scale-0 group-hover:opacity-0"
                  alt="Flux"
                />
                <Home
                  className="size-4 shrink-0 text-foreground transition-[opacity,transform] duration-150 absolute scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
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

      {/* ── Center: Document Breadcrumb & Inline Rename ── */}
      <DocumentBreadcrumb />

      {/* ── Right: Save Status, Share, History, Quick Layout Switcher & Settings Trigger ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Save Status Indicator */}
        <div className="flex items-center shrink-0 mr-0.5">
          {isSaving ? (
            <span
              className="flex items-center gap-1 text-11 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full select-none"
              title="Saving changes..."
            >
              <Loader2 className="size-3 animate-spin shrink-0" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-11 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors px-1.5 py-0.5 rounded select-none cursor-default"
              title="All changes saved to cloud"
            >
              <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline text-11 text-[11px]">Saved</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          title="Share Project & Manage Collaborators"
          aria-label="Share Project"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer outline-none select-none"
        >
          <Users className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={handleToggleReview}
          title={
            totalReviewItems > 0
              ? `Review (${openCommentsCount} open comments, ${pendingSuggestionsCount} pending suggestions)`
              : "Review & Track Changes"
          }
          aria-label="Review & Track Changes"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer outline-none select-none",
            isReviewOpen
              ? "bg-[#166534] text-white shadow-2xs font-semibold"
              : "text-foreground/80 hover:text-foreground hover:bg-sidebar-hover"
          )}
        >
          <MessageSquareQuote className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Review</span>
          {totalReviewItems > 0 && (
            <span
              className={cn(
                "flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold leading-none select-none",
                isReviewOpen
                  ? "bg-white text-[#166534]"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
              )}
            >
              {totalReviewItems}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleHistory}
          title="Project History & Revisions"
          aria-label="Project History"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer outline-none select-none",
            isHistoryOpen
              ? "bg-[#166534] text-white shadow-2xs font-semibold"
              : "text-foreground/80 hover:text-foreground hover:bg-sidebar-hover"
          )}
        >
          <History className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">History</span>
        </button>

        <LayoutSwitcher />
        <Trigger />

        <ShareProjectModal />
        <TemplateGalleryModal />
        <KeyboardShortcutsModal
          open={isShortcutsOpen}
          onOpenChange={setIsShortcutsOpen}
        />
        <QuickOpenModal
          open={isQuickOpenOpen}
          onOpenChange={setIsQuickOpenOpen}
        />
      </div>
    </nav>
  );
}
