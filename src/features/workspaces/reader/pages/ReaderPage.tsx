'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, FileText, FileQuestion, ChevronLeft } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { useReader } from '../hooks/use-reader';
import Topbar from '../components/Topbar';
import Panel from '../components/Panel';
import BibtexModal from '../components/modals/BibtexModal';

const Viewer = dynamic(() => import('../components/viewer/Viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-muted">
      <div className="flex flex-col gap-3 p-8 bg-card border border-border rounded-md animate-pulse select-none w-[600px] max-w-[90vw] h-[848px] max-h-[85vh]">
        <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
        <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
        <div className="space-y-2.5 flex-1">
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-11/12 bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-4/5 bg-muted rounded-sm" />
          <div className="h-2 w-full bg-muted rounded-sm mt-4" />
          <div className="h-2 w-full bg-muted rounded-sm" />
          <div className="h-2 w-9/12 bg-muted rounded-sm" />
        </div>
        <div className="h-2 w-1/4 bg-muted rounded-sm self-center mt-auto" />
      </div>
    </div>
  ),
});

interface ReaderPageProps {
  paperId?: string | null;
  onBack?: () => void;
}

export default function ReaderPage({ paperId, onBack }: ReaderPageProps = {}) {
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
    isReindexing,
    selectionContext,
    pendingNoteText,
    bibtexOpen,
    fulltext,
    isLoadingFulltext,
    targetPage,
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
    clearSelectionContext,
    handleReindex,
    handleUpdateTitle,
    handleResizeMouseDown,
    handleRetryPdf,
    goBack,
  } = actions;

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background ${isResizingPanel ? 'select-none' : ''}`}>
      <Topbar
        paper={paper}
        paperUrl={paperUrl}
        activePanel={activePanel}
        isReindexing={isReindexing}
        setActivePanel={setActivePanel}
        setBibtexOpen={setBibtexOpen}
        onPanelToggle={handlePanelToggle}
        onReindex={handleReindex}
        onUpdateTitle={handleUpdateTitle}
        onBack={goBack}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 animate-spin text-primary/60 shrink-0" />
              <p className="text-xs text-muted-foreground">Loading paper...</p>
            </div>
          ) : !paper ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center max-w-sm mx-auto">
              <div className="size-12 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <FileQuestion className="size-6 text-muted-foreground shrink-0" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Document not found</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The document you are looking for does not exist, was removed, or cannot be accessed.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                className="mt-2 text-xs font-medium cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
              >
                <ChevronLeft className="size-3.5 mr-1 shrink-0" />
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
              fulltext={fulltext}
              isLoadingFulltext={isLoadingFulltext}
              targetPage={targetPage}
              paper={paper}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center max-w-lg mx-auto">
              <div className="size-14 rounded-md bg-card border border-border flex items-center justify-center text-foreground">
                <FileText className="size-7 text-foreground shrink-0" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  {paper.title || 'Paper Metadata & Reference'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                  {paper.abstract
                    ? (paper.abstract.length > 200 ? `${paper.abstract.substring(0, 200)}...` : paper.abstract)
                    : 'No PDF file attached to this paper entry. You can review metadata, crawl DOI details, and manage notes using the side panels.'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePanelToggle('details')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <FileText className="size-3.5 text-foreground shrink-0" />
                  <span>View Details</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePanelToggle('notes')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <span>Open Notes</span>
                </Button>
              </div>
            </div>
          )}
        </main>

        {activePanel ? (
          <Panel
            paper={paper}
            workspaceId={workspaceId}
            activePanel={activePanel}
            panelWidth={panelWidth}
            isResizing={isResizingPanel}
            isLoading={isLoadingPapers}
            pendingNoteText={pendingNoteText}
            clearPendingNoteText={() => setPendingNoteText('')}
            setActivePanel={setActivePanel}
            onResizeMouseDown={handleResizeMouseDown}
            onNavigateToPage={handleNavigateToPage}
          />
        ) : null}

        {activePanel ? (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={() => setActivePanel(null)}
            aria-label="Close reader panel overlay"
          />
        ) : null}
      </div>

      {paper ? (
        <BibtexModal paper={paper} open={bibtexOpen} onOpenChange={setBibtexOpen} />
      ) : null}
    </div>
  );
}
