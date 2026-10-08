/**
 * PrimarySidebar.tsx
 *
 * Canonical VS Code-Style Primary Sidebar Viewlet Container (Block 3: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/PrimarySidebar.tsx`
 *
 * Switches content dynamically based on `activeSidebarTab`:
 * - Files: Project file tree, upload, folder creation.
 * - Search: Full project regex/text search with replace.
 * - Citations: BibTeX items, Zotero sync, and reference inserting.
 * - Review: Document suggestions and review comments.
 * - Chat: Realtime team discussion channel.
 * - AI: AI Research Assistant (Hosted directly in the Left Sidebar).
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useLayoutStore } from '../../../store/layout.store';

import FilesTab from './explorer/FilesTab';

const PanelLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-xs">Loading viewlet...</span>
  </div>
);

const SearchTab = dynamic(() => import('./search/SearchTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const CitationTab = dynamic(() => import('./citation/CitationTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const ReviewTab = dynamic(() => import('./review/ReviewTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const ChatTab = dynamic(() => import('./chat/ChatTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const AiTab = dynamic(() => import('./ai/AiTab'), {
  ssr: false,
  loading: PanelLoadingFallback,
});

const OutlineTab = dynamic(() => import('./outline/OutlineTab'), {
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
      case 'outline':
        return <OutlineTab onClose={handleClose} />;
      case 'search':
        return <SearchTab onClose={handleClose} />;
      case 'citations':
        return <CitationTab onClose={handleClose} />;
      case 'review':
        return <ReviewTab onClose={handleClose} />;
      case 'chat':
        return <ChatTab onClose={handleClose} />;
      case 'ai':
        return <AiTab onClose={handleClose} />;
      default:
        return <FilesTab onClose={handleClose} />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden select-none">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

export default PrimarySidebar;
