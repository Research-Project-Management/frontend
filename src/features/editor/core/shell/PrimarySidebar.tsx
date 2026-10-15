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
import { Loader2 } from 'lucide-react';
import { useLayoutStore } from '@/features/editor/core';
import { FilesTab } from '@/features/editor/subsystems/explorer';

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-xs">Loading viewlet...</span>
  </div>
);

const SearchTab = dynamic(() => import('@/features/editor/subsystems/search').then((m) => m.SearchTab), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const CitationTab = dynamic(() => import('@/features/editor/subsystems/citation').then((m) => m.CitationTab), {
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
  const {
    activeSidebarTab,
    setSidebarLeftOpen,
  } = useLayoutStore();

  const handleClose = () => {
    setSidebarLeftOpen(false);
  };

  const renderContent = () => {
    switch (activeSidebarTab) {
      case 'files':
        return <FilesTab onClose={handleClose} />;
      case 'search':
        return <SearchTab onClose={handleClose} />;
      case 'citations':
        return <CitationTab onClose={handleClose} />;
      case 'review':
        return <ReviewTab onClose={handleClose} />;
      case 'ai':
        return <AiTab onClose={handleClose} />;
      default:
        return <FilesTab onClose={handleClose} />;
    }
  };

  return (
    <aside
      className="flex h-full flex-col bg-surface border-r border-border min-w-0 overflow-hidden select-none"
      role="region"
      aria-label="Primary Sidebar"
    >
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </aside>
  );
}

export default PrimarySidebar;
