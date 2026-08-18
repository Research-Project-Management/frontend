'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Loader2, FileText } from 'lucide-react';
import { useReader } from '../hooks/reader/use-reader';
import Viewer from '../components/reader/viewer/Viewer';
import Topbar from '../components/reader/topbar/Topbar';
import Panel from '../components/reader/panel/Panel';
import BibtexModal from '../components/reader/system/BibtexModal';

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
    pendingNoteText,
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
    handleAddToNote,
    setPendingNoteText,
    clearSelectionContext,
    handleReindex,
    handleTitleSave,
    handleResizeMouseDown,
    goBack,
  } = actions;

  // Global Keyboard Shortcuts for Reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      // Esc to close panel
      if (e.key === 'Escape' && !isInput) {
        if (activePanel) {
          e.preventDefault();
          setActivePanel(null);
        }
      }

      // Panel toggles with Ctrl/Cmd + Shift
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          handlePanelToggle('ai');
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handlePanelToggle('notes');
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          handlePanelToggle('details');
        }
      }

      // BibTeX modal with Ctrl/Cmd + B
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b' && !isInput) {
        e.preventDefault();
        setBibtexOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, handlePanelToggle, setActivePanel, setBibtexOpen]);

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background ${isResizingPanel ? 'select-none' : ''}`}>
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
            <Viewer
              blobUrl={pdfBlobUrl}
              filename={paper?.filename || 'paper.pdf'}
              isLoading={pdfLoading}
              error={pdfError}
              onAskAi={handleAskAi}
              onAddToNote={handleAddToNote}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center max-w-lg mx-auto">
              <div className="size-14 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground shadow-xs">
                <FileText className="size-7 text-foreground/70" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  {paper?.title || 'Paper Metadata & Reference'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                  {paper?.abstract
                    ? (paper.abstract.length > 200 ? `${paper.abstract.substring(0, 200)}...` : paper.abstract)
                    : 'No PDF file attached to this paper entry. You can review metadata, crawl DOI details, and manage notes using the side panels.'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handlePanelToggle('details')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                >
                  <FileText className="size-3.5 text-foreground" />
                  <span>View Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePanelToggle('notes')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <span>Open Notes</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {activePanel ? (
          <Panel
            paper={paper}
            collection={paperCollection}
            workspaceId={workspaceId}
            activePanel={activePanel}
            panelWidth={panelWidth}
            isResizing={isResizingPanel}
            isLoading={isLoadingPapers}
            isReindexing={isReindexing}
            selectionContext={selectionContext}
            pendingNoteText={pendingNoteText}
            clearSelectionContext={clearSelectionContext}
            clearPendingNoteText={() => setPendingNoteText('')}
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
