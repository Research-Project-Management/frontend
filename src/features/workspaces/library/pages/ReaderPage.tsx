'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useReader } from '../hooks/reader/use-reader';
import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('../components/reader/pdf-viewer/pdf-viewer'), { ssr: false });
import Topbar from '../components/reader/layout/topbar';
import Sidebar from '../components/reader/layout/sidebar';
import BibtexModal from '../components/reader/modals/bibtex-modal';

export default function ReaderPage() {
  const { state, actions } = useReader();
  const {
    workspaceId,
    isLoadingPapers,
    paper,
    paperCollection,
    paperUrl,
    pdfBlobUrl,
    pdfLoading,
    pdfError,
    activePanel,
    panelWidth,
    isResizingPanel,
    isReindexing,
    selectionContext,
    isEditingTitle,
    draftTitle,
    bibtexOpen,
  } = state;

  const {
    setActivePanel,
    setIsEditingTitle,
    setDraftTitle,
    setBibtexOpen,
    handlePanelToggle,
    handleAskAi,
    clearSelectionContext,
    handleReindex,
    handleTitleSave,
    handleResizeMouseDown,
    navigate,
    goBack,
  } = actions;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <Topbar
        paper={paper}
        paperUrl={paperUrl}
        activePanel={activePanel}
        isReindexing={isReindexing}
        isEditingTitle={isEditingTitle}
        draftTitle={draftTitle}
        setActivePanel={setActivePanel}
        setIsEditingTitle={setIsEditingTitle}
        setDraftTitle={setDraftTitle}
        setBibtexOpen={setBibtexOpen}
        onPanelToggle={handlePanelToggle}
        onReindex={handleReindex}
        onTitleSave={handleTitleSave}
        onBack={goBack}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted/45">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 animate-spin text-primary/60" />
              <p className="text-xs text-muted-foreground">Loading paper...</p>
            </div>
          ) : paperUrl ? (
            <PdfViewer
              blobUrl={pdfBlobUrl}
              filename={paper?.filename || 'paper.pdf'}
              isLoading={pdfLoading}
              error={pdfError}
              onAskAi={handleAskAi}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-foreground">File not found</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  The PDF file could not be located. Check that the paper upload finished successfully.
                </p>
              </div>
            </div>
          )}
        </main>

        {activePanel ? (
          <Sidebar
            paper={paper}
            collection={paperCollection}
            workspaceId={workspaceId}
            activePanel={activePanel}
            panelWidth={panelWidth}
            isResizing={isResizingPanel}
            isLoading={isLoadingPapers}
            isReindexing={isReindexing}
            selectionContext={selectionContext}
            clearSelectionContext={clearSelectionContext}
            setActivePanel={setActivePanel}
            onReindex={handleReindex}
            onResizeMouseDown={handleResizeMouseDown}
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
