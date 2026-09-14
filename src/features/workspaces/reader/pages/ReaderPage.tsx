'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { useRouter } from 'next/navigation';
import { useReader } from '../hooks/use-reader';
import { useReaderStore } from '../store/reader.store';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import Topbar from '../components/Topbar';
import MenuBar from '../components/MenuBar';
import ReaderToolbar from '../components/ReaderToolbar';
import Sidebar from '../components/Sidebar';
import Panel from '@/features/workspaces/library/components/Panel';
import BibtexModal from '../components/modals/BibtexModal';
import Systembar from '../components/Systembar';
import DocumentNavDrawer from '../components/viewer/DocumentNavDrawer';

const Viewer = dynamic(() => import('../components/viewer/Viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-muted">
      <div className="flex flex-col gap-3 p-8 bg-card border border-border rounded-md animate-pulse select-none w-[600px] max-w-[90vw] h-[848px] max-h-[85vh]">
        <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
        <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
        <div className="space-y-2 flex-1">
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-11/12 bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-4/5 bg-muted rounded-sm" />
        </div>
      </div>
    </div>
  ),
});

export interface ReaderPageProps {
  paperId?: string | null;
  onBack?: () => void;
}

export default function ReaderPage({ paperId, onBack }: ReaderPageProps = {}) {
  const router = useRouter();
  const { state, actions } = useReader(paperId, onBack);
  const {
    workspaceId,
    isLoadingPapers,
    paper,
    paperUrl,
    pdfBlobUrl,
    pdfLoading,
    pdfError,
    activePanel,
    panelWidth,
    isResizingPanel,
    pendingNoteText,
    bibtexOpen,
    fulltext,
    isLoadingFulltext,
    targetPage,
    isSidebarOpen,
    visiblePage,
    numPages,
    zoom,
    selectedAnnotationIds,
    isBatchProcessing,
    annotations = [],
    effectiveAttachmentId,
  } = state;

  const {
    setActivePanel,
    setBibtexOpen,
    handlePanelToggle,
    handleAskAi,
    handleAddToNote,
    handleAnnotate,
    handleNavigateToPage,
    setPendingNoteText,
    handleResizeMouseDown,
    handleRetryPdf,
    goBack,
    setIsSidebarOpen,
    setZoom,
    setSelectedAnnotationIds,
    handleToggleSelectAnnotation,
    handleBatchChangeColor,
    handleBatchDelete,
    handleBatchAddToNote,
    deleteAnnotation,
  } = actions;

  // Zotero 7 Multi-Tab Store
  const {
    tabs,
    activeTabId,
    openReader,
    closeTab,
    setActiveTab,
    activeColor,
    setActiveColor,
    activeTool,
    setActiveTool,
  } = useReaderStore();

  // Library Sidebar / Inspector Store (Unified between Library and Reader)
  const { isInspectorOpen, setIsInspectorOpen, activeScope } = useLibrarySidebarStore();

  // In-Document Search & Academic Entities Drawer
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isEntitiesDrawerOpen, setIsEntitiesDrawerOpen] = useState<boolean>(false);

  // Global keyboard shortcut: Ctrl+F / Cmd+F to toggle document search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Register opened paper into tab store
  useEffect(() => {
    if (paper?.id) {
      openReader(paper.id, paper.title || 'Untitled Document');
    }
  }, [paper?.id, paper?.title, openReader]);

  const handleSelectTab = (id: string) => {
    if (id === 'library') {
      goBack();
    } else {
      setActiveTab(id);
      router.push(`/library/papers/${id}`);
    }
  };

  const handleCloseTab = (id: string) => {
    closeTab(id);
    if (activeTabId === id || (paper && paper.id === id)) {
      const remaining = tabs.filter((t) => t.id !== id);
      const next = remaining[remaining.length - 1] || { id: 'library' };
      if (next.id === 'library') {
        goBack();
      } else {
        router.push(`/library/papers/${next.id}`);
      }
    }
  };

  // Additional Academic Reader States (Pan/Select, Rotation, Reading Theme)
  const [interactionMode, setInteractionMode] = useState<'select' | 'hand'>('select');
  const [rotation, setRotation] = useState<number>(0);
  const [themeMode, setThemeMode] = useState<'normal' | 'sepia' | 'dark'>('normal');

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleToggleThemeMode = () => {
    setThemeMode((m) => (m === 'normal' ? 'sepia' : m === 'sepia' ? 'dark' : 'normal'));
  };

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background ${isResizingPanel ? 'select-none' : ''}`}>
      {/* 0. ZOTERO 7 APPLICATION MENU BAR (File, Edit, View, Go) */}
      <MenuBar />

      {/* 1. ZOTERO 7 MULTI-PAPER TAB BAR (Hàng 1) */}
      <Topbar
        paper={paper}
        tabs={tabs}
        activeTabId={paper?.id || activeTabId}
        scopeTitle={activeScope?.name}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onBack={goBack}
      />

      {/* 2. ZOTERO 7 DEDICATED READER TOOLBAR (Hàng 2) */}
      {paperUrl && (
        <ReaderToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          visiblePage={visiblePage}
          numPages={numPages}
          onNavigateToPage={handleNavigateToPage}
          interactionMode={interactionMode}
          onSelectInteractionMode={setInteractionMode}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          activeColor={activeColor}
          onSelectColor={setActiveColor}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
          onSetZoom={setZoom}
          onFitWidth={() => setZoom(1.0)}
          rotation={rotation}
          onRotate={handleRotate}
          themeMode={themeMode}
          onToggleThemeMode={handleToggleThemeMode}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
          isEntitiesDrawerOpen={isEntitiesDrawerOpen}
          onToggleEntitiesDrawer={() => setIsEntitiesDrawerOpen((v) => !v)}
        />
      )}

      {/* WORKSPACE VIEWPORT */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted">
        {/* 3. SIDEBAR (Collapsible 288px: Outline, Annotations & Pages) */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentPage={visiblePage}
          totalPages={numPages}
          onJumpToPage={handleNavigateToPage}
          fulltext={fulltext}
          paper={paper}
          workspaceId={workspaceId}
          attachmentId={effectiveAttachmentId}
          selectedIds={selectedAnnotationIds}
          onToggleSelect={handleToggleSelectAnnotation}
          annotationsCount={annotations.length}
        />

        {/* 4. MAIN PDF CANVAS */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden relative">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
              <p className="text-12 text-muted-foreground font-mono">Loading document...</p>
            </div>
          ) : !paper ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center max-w-sm mx-auto">
              <div className="size-10 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <FileQuestion className="size-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-13 font-semibold text-foreground">Document not found</h3>
                <p className="text-12 text-muted-foreground leading-relaxed">
                  The document could not be found or you do not have permission.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                className="h-8 px-3 mt-1 text-12 font-medium rounded-md shadow-none cursor-pointer border-border"
              >
                <ChevronLeft className="size-3.5 mr-1 shrink-0" strokeWidth={1.5} />
                Return to Library
              </Button>
            </div>
          ) : paperUrl ? (
            <Viewer
              blobUrl={pdfBlobUrl}
              isLoading={pdfLoading}
              error={pdfError}
              onRetry={handleRetryPdf}
              onAskAi={handleAskAi}
              onAddToNote={handleAddToNote}
              onAnnotate={handleAnnotate}
              annotations={annotations}
              onDeleteAnnotation={(ann) => deleteAnnotation && deleteAnnotation(ann.id, ann.version)}
              fulltext={fulltext}
              isLoadingFulltext={isLoadingFulltext}
              targetPage={targetPage}
              paper={paper}
              onVisiblePageChange={actions.setVisiblePage}
              onTotalPagesChange={actions.setNumPages}
              zoom={zoom}
              rotation={rotation}
              themeMode={themeMode}
              interactionMode={interactionMode}
              activeColor={activeColor}
              activeTool={activeTool}
              isSearchOpen={isSearchOpen}
              onCloseSearch={() => setIsSearchOpen(false)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <p className="text-13 font-medium text-foreground mb-1">
                {paper.title || 'Paper Reference'}
              </p>
              <p className="text-12 text-muted-foreground leading-relaxed mb-4">
                No PDF file attached to this entry. You can review metadata or notes using the side panel.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspectorOpen(true)}
                className="h-8 px-3 text-12 font-medium rounded-md shadow-none cursor-pointer border-border"
              >
                Open Details
              </Button>
            </div>
          )}
        </main>

        {/* Academic Entities Drawer (Figures, Tables, Formulas) */}
        <DocumentNavDrawer
          isOpen={isEntitiesDrawerOpen}
          onClose={() => setIsEntitiesDrawerOpen(false)}
          fulltext={fulltext}
          isLoading={isLoadingFulltext}
          currentPage={visiblePage}
          onJumpToPage={(p) => handleNavigateToPage(p)}
        />

        {/* 5. UNIFIED INSPECTOR PANEL */}
        <Panel
          paper={paper as any}
          item={paper as any}
          workspaceId={workspaceId}
          onClose={() => setIsInspectorOpen(false)}
        />
      </div>

      {/* Batch Annotation Action Bar (Dock) */}
      <Systembar
        selectedCount={selectedAnnotationIds.size}
        onClearSelection={() => setSelectedAnnotationIds(new Set())}
        onChangeColor={handleBatchChangeColor}
        onAddToNote={handleBatchAddToNote}
        onBatchDelete={handleBatchDelete}
        isProcessing={isBatchProcessing}
      />

      {/* BibTeX / RIS Export Modal */}
      {paper && (
        <BibtexModal paper={paper} open={bibtexOpen} onOpenChange={setBibtexOpen} />
      )}
    </div>
  );
}
