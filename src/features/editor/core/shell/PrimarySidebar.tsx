/**
 * PrimarySidebar.tsx
 *
 * Canonical VS Code-Style Primary Sidebar Viewlet Container (Core Workbench Shell).
 *
 * Switches content dynamically based on `activeSidebarTab`:
 * - Files: Project file tree, upload, folder creation.
 * - Search: Full project regex/text search with replace.
 * - Citations: BibTeX items, Zotero sync, and reference inserting.
 * - Review: Document suggestions and review comments.
 * - Outline: Document section headings outline.
 * - AI: AI Research Assistant (Hosted directly in the Left Sidebar).
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useWorkspaceStore } from '../store/workspace.store';
import { FilesTab } from '@/features/editor/subsystems/explorer';

const SIDEBAR_PANEL_SKELETON_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-20'];

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full flex-col bg-surface">
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
      <Skeleton className="h-3.5 w-20 rounded-sm" />
      <Skeleton className="size-4 rounded-sm" />
    </div>
    <div className="p-3 space-y-3">
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="space-y-2 pt-1">
        {SIDEBAR_PANEL_SKELETON_WIDTHS.map((widthClass, idx) => (
          <div key={idx} className="flex items-center gap-2 px-1 py-1">
            <Skeleton className="size-3.5 rounded-sm shrink-0" />
            <Skeleton className={`h-3.5 rounded-sm ${widthClass}`} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SearchTab = dynamic(() => import('@/features/editor/subsystems/search').then((m) => m.SearchTab), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const ReviewTab = dynamic(() => import('@/features/editor/subsystems/review').then((m) => m.ReviewTab), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const AiTab = dynamic(() => import('@/features/editor/subsystems/ai').then((m) => m.AiTab), {
  ssr: false,
  loading: PanelLoadingFallback,
});

export function PrimarySidebar() {
  const activeSidebarTab = useWorkspaceStore((s) => s.activeSidebarTab);
  const setSidebarLeftOpen = useWorkspaceStore((s) => s.setSidebarLeftOpen);

  const handleClose = () => {
    setSidebarLeftOpen(false);
  };

  const renderContent = () => {
    switch (activeSidebarTab) {
      case 'files':
        return <FilesTab onClose={handleClose} />;
      case 'search':
        return <SearchTab />;
      case 'review':
        return <ReviewTab onClose={handleClose} />;
      case 'ai':
        return <AiTab />;
      default:
        return <FilesTab onClose={handleClose} />;
    }
  };

  return (
    <div
      className="flex h-full flex-col min-w-0 overflow-hidden select-none"
      role="region"
      aria-label="Primary Sidebar"
    >
      {renderContent()}
    </div>
  );
}

export default PrimarySidebar;
