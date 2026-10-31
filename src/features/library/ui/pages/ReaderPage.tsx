"use client";

import { ReaderRetractionBanner } from "@/features/library/ui/reader/ReaderRetractionBanner";
import { resolveEpubOrSnapshot } from "@/features/library/domain/reader.domain";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { useRouter, useSearchParams } from "next/navigation";
import { openInNewTab } from "@/features/library/core/coordinator/browser-io.helpers";
import { cn } from "@/shared/lib/utils";
import { Loader2 } from "lucide-react";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { useReader } from "@/features/library/core/coordinator/reader/use-reader";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "@/features/library/core/store/reader.store";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useAiCompanionStore } from "@/features/ai/store/ai-companion.store";
import { useLibraryPermissions } from "@/features/library/core/coordinator/permissions.coordinator";
import {
  useOcrExtraction,
  useExportAnnotatedPdf,
} from "@/features/library/sdk/queries/reader.queries";
import { ReaderInspector } from "@/features/library/ui/inspector/ReaderInspector";
import Topbar from "@/features/library/ui/reader/ReaderTopbar";
import ReaderToolbar from "@/features/library/ui/reader/ReaderToolbar";
import type {
  AnnotationRect,
  ReaderNavigationTarget,
  PdfOutlineItem,
} from "@/features/library/domain/types/reader.types";
import {
  useReaderTabHistory,
  useReaderTabPresentation,
  resolveDocumentOcrState,
} from "./reader-page.helpers";

const Sidebar = dynamic(() => import("@/features/library/ui/reader/ReaderSidebar"), {
  ssr: false,
});

const BibtexModal = dynamic(() => import("@/features/library/ui/modals/BibtexModal"), { ssr: false });
const AiCompanionSidebar = dynamic(
  () => import("@/features/ai/components/companion/AiCompanionSidebar"),
  { ssr: false, loading: () => null },
);

const Viewer = dynamic(
  () => import("@/features/library/ui/reader/viewer/Viewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-muted">
        <div className="flex flex-col gap-3 p-8 bg-card border border-border rounded-md animate-pulse select-none w-[600px] max-w-[90vw] h-[848px] max-h-[85vh]">
          <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
          <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
          <div className="space-y-2 flex-1">
            {[100, 100, 92, 100, 80].map((w, i) => (
              <div key={i} className="h-2 bg-muted rounded-sm" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

const EpubAndSnapshotViewer = dynamic<import("@/features/library/ui/reader/viewer/EpubAndSnapshotViewer").EpubAndSnapshotViewerProps>(
  () => import("@/features/library/ui/reader/viewer/EpubAndSnapshotViewer"),
  { ssr: false },
);

export interface ReaderPageProps {
  paperId?: string | null;
  onBack?: () => void;
}

export function ReaderPage({ paperId, onBack }: ReaderPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearchQuery =
    searchParams.get("q") || searchParams.get("search") || undefined;
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const { canEditItem: canEdit } = useLibraryPermissions();
  const { state, actions } = useReader(paperId, onBack);
  const {
    scopeId,
    isProject,
    rawProjectId,
    isLoadingPapers,
    paper,
    paperUrl,
    pdfBlobUrl,
    pdfLoading,
    pdfError,
    pendingNoteText,
    bibtexOpen,
    fulltext,
    targetPage,
    isSidebarOpen,
    visiblePage,
    numPages,
    zoom,
    selectedAnnotationIds,
    annotations = [],
    isLoadingAnnotations,
    isAnnotationsError,
    isUpdatingAnnotation,
    isExtractingNotes,
    isImportingAnnotations,
    effectiveAttachmentId,
  } = state;

  const {
    setBibtexOpen,
    handleAddToNote,
    handleAnnotate,
    handleNavigateToPage,
    handleNavigateToAnnotation,
    setPendingNoteText,
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
    updateAnnotation,
    extractNotes,
    importExternal,
    refetchAnnotations,
  } = actions;

  // Standard URL citation jumping: ?page=X&annotation=Y (only fires when URL params change)
  const lastHandledDeepLinkRef = useRef<string>("");
  useEffect(() => {
    const pageParam = searchParams.get("page");
    const annParam = searchParams.get("annotation") || undefined;
    const linkKey = `${paper?.id || ""}:${pageParam || ""}:${annParam || ""}`;
    if (lastHandledDeepLinkRef.current === linkKey) return;
    lastHandledDeepLinkRef.current = linkKey;

    if (pageParam) {
      const p = parseInt(pageParam, 10);
      if (!isNaN(p) && p >= 1) {
        handleNavigateToAnnotation(p, annParam);
      }
    }
  }, [searchParams, paper?.id, handleNavigateToAnnotation]);

  // Multi-Tab Store
  const {
    tabs,
    activeTabId,
    openReader,
    closeTab,
    setActiveTab,
    updateTabState,
    activeColor,
    setActiveColor,
    activeTool,
    setActiveTool,
  } = useReaderStore(
    useShallow((s) => ({
      tabs: s.tabs,
      activeTabId: s.activeTabId,
      openReader: s.openReader,
      closeTab: s.closeTab,
      setActiveTab: s.setActiveTab,
      updateTabState: s.updateTabState,
      activeColor: s.activeColor,
      setActiveColor: s.setActiveColor,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
    })),
  );

  const effectiveTabId = paper?.id || activeTabId;
  const activeTab = tabs.find((t) => t.id === effectiveTabId);

  // Reader inspector toggle backed directly by global library UI store
  const isGlobalInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const setIsGlobalInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);

  const handleToggleInspector = useCallback(() => {
    setIsGlobalInspectorOpen(!isGlobalInspectorOpen);
  }, [isGlobalInspectorOpen, setIsGlobalInspectorOpen]);

  const handleCloseInspector = useCallback(() => {
    setIsGlobalInspectorOpen(false);
  }, [setIsGlobalInspectorOpen]);

  // In-Document Search
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(
    Boolean(initialSearchQuery),
  );

  // Page Presentation Mode (Continuous Scroll, Single Page, Two Pages/Spread)
  const [viewMode, setViewMode] = useState<"single" | "continuous" | "spread">(
    "continuous",
  );

  const {
    fitMode,
    setFitMode,
    rotation,
    setRotation,
    themeMode,
    setThemeMode,
    setTabZoom,
  } = useReaderTabPresentation({
    effectiveTabId,
    activeTab,
    zoom,
    visiblePage,
    setZoom,
    updateTabState,
  });

  // Global keyboard shortcut: Ctrl+F / Cmd+F to toggle document search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Register opened paper into tab store
  useEffect(() => {
    if (paper?.id) {
      openReader(paper.id, paper.title || "Untitled Document");
    }
  }, [paper?.id, paper?.title, openReader]);

  const getPaperUrl = useCallback(
    (id: string) =>
      isProject && rawProjectId
        ? `/projects/${rawProjectId}/library/papers/${id}`
        : `/library/papers/${id}`,
    [isProject, rawProjectId],
  );

  const handleSelectTab = (id: string) => {
    if (id === "library") {
      goBack();
    } else {
      setActiveTab(id);
      router.push(getPaperUrl(id));
    }
  };

  const handleCloseTab = (id: string) => {
    closeTab(id);
    if (activeTabId === id || (paper && paper.id === id)) {
      const remaining = tabs.filter((t) => t.id !== id);
      const next = remaining[remaining.length - 1] || { id: "library" };
      if (next.id === "library") {
        goBack();
      } else {
        router.push(getPaperUrl(next.id));
      }
    }
  };

  // Academic Reader States (Pan/Select, Split View, Reading Mode, Lock Tool)
  const [interactionMode, setInteractionMode] = useState<"select" | "hand">("select");
  const [splitMode, setSplitMode] = useState<"none" | "horizontal" | "vertical">("none");
  const [secondaryPage, setSecondaryPage] = useState<number>(1);
  const [secondaryScrollRequest, setSecondaryScrollRequest] =
    useState<ReaderNavigationTarget | null>(null);
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);

  useEffect(() => {
    setPdfOutline([]);
  }, [paper?.id, effectiveAttachmentId]);

  const handleSelectSplitMode = useCallback(
    (nextMode: "none" | "horizontal" | "vertical") => {
      setSplitMode((prev) => {
        if (prev === "none" && nextMode !== "none") {
          setSecondaryPage(visiblePage);
          setSecondaryScrollRequest({
            pageNumber: visiblePage,
            timestamp: Date.now(),
          });
        }
        return nextMode;
      });
    },
    [visiblePage],
  );

  const {
    pageHistory,
    forwardHistory,
    handleNavigateToPageWithHistory,
    handleNavigateBack,
    handleNavigateForward,
  } = useReaderTabHistory({
    effectiveTabId,
    visiblePage,
    onNavigateToPage: handleNavigateToPage,
    onNavigateToAnnotation: actions.handleNavigateToAnnotation,
  });

  // Escape key exits distraction-free reading mode or resets active annotation tool to 'select'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (isReadingMode) {
        setIsReadingMode(false);
        return;
      }
      if (activeTool && activeTool !== "select") {
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReadingMode, activeTool, setActiveTool]);

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleToggleThemeMode = (mode?: "normal" | "dark" | "sepia" | "invert") => {
    if (mode) {
      setThemeMode(mode);
    } else {
      setThemeMode((m) =>
        m === "normal" ? "sepia" : m === "sepia" ? "dark" : "normal",
      );
    }
  };

  const { triggerOcr } = useOcrExtraction(scopeId, paper?.id);

  const handleAddToNoteAndExitReadingMode = useCallback(
    (text: string, pageNumber?: number, annotationId?: string) => {
      if (isReadingMode) {
        setIsReadingMode(false);
      }
      handleAddToNote(text, pageNumber, annotationId);
    },
    [isReadingMode, handleAddToNote],
  );

  const setQuotedPassage = useAiCompanionStore((s) => s.setQuotedPassage);

  const handleAskAiWithSelection = useCallback(
    (selectedText: string, pageNumber?: number) => {
      const cleaned = selectedText.trim();
      if (!cleaned) return;
      if (isReadingMode) {
        setIsReadingMode(false);
      }
      setQuotedPassage({
        text: cleaned,
        pageNumber: pageNumber || visiblePage,
        paperId: paper?.id,
        paperTitle: paper?.title || "Current Paper",
      });
    },
    [isReadingMode, setQuotedPassage, visiblePage, paper?.id, paper?.title],
  );

  // Zotero 7 behavior: If tool is not locked and is not 'select', revert back to 'select' after creating annotation
  const handleAnnotateWithLock = useCallback(
    async (
      text: string,
      pageNum?: number,
      colorHex?: string,
      rects?: AnnotationRect[],
      type?: "highlight" | "underline" | "note" | "text" | "rect" | "area",
      comment?: string,
    ) => {
      const res = await handleAnnotate(
        text,
        pageNum,
        colorHex,
        rects,
        type,
        comment,
      );
      if (!isToolLocked && activeTool !== "select") {
        setActiveTool("select");
      }
      return res;
    },
    [handleAnnotate, isToolLocked, activeTool, setActiveTool],
  );

  // Scanned document detection & OCR status
  const { isScanned, ocrStatus } = resolveDocumentOcrState(
    paper,
    effectiveAttachmentId,
    fulltext,
    numPages,
  );

  const handleTriggerOcr = useCallback(async () => {
    if (!effectiveAttachmentId) return;
    try {
      await triggerOcr(effectiveAttachmentId);
    } catch {
      // Handled by useOcrExtraction hook toast
    }
  }, [effectiveAttachmentId, triggerOcr]);

  const { exportAnnotatedPdf } = useExportAnnotatedPdf(scopeId || "user");

  const handleExportAnnotatedPdf = useCallback(async () => {
    const currentPaperId = paper?.id || activeTabId;
    if (!currentPaperId || currentPaperId === "library") return;
    try {
      await exportAnnotatedPdf(
        currentPaperId,
        `${paper?.title || "document"}-annotated.pdf`,
        effectiveAttachmentId,
      );
    } catch {
      // Handled in useExportAnnotatedPdf hook toast
    }
  }, [paper, activeTabId, effectiveAttachmentId, exportAnnotatedPdf]);

  const handleDeleteAnnotationProp = useCallback(
    (ann: { id: string; version?: number }) => {
      if (deleteAnnotation) deleteAnnotation(ann.id, ann.version);
    },
    [deleteAnnotation],
  );

  const handleUpdateAnnotationProp = useCallback(
    (
      id: string,
      version: number | undefined,
      dto: { color?: string; comment?: string; quoteText?: string; tags?: string[] },
    ) => {
      if (updateAnnotation) return updateAnnotation(id, version, dto);
      return Promise.resolve();
    },
    [updateAnnotation],
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((v) => !v);
  }, [setIsSidebarOpen]);

  const handleToggleToolLocked = useCallback(() => {
    setIsToolLocked((v) => !v);
  }, []);

  const handleZoomIn = useCallback(() => {
    setFitMode("custom");
    setTabZoom((z) => Math.min(3.0, +(z + 0.15).toFixed(2)), "custom");
  }, [setFitMode, setTabZoom]);

  const handleZoomOut = useCallback(() => {
    setFitMode("custom");
    setTabZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)), "custom");
  }, [setFitMode, setTabZoom]);

  const handleSetCustomZoom = useCallback(
    (nextZoom: number) => {
      setFitMode("custom");
      setTabZoom(Math.min(3.0, Math.max(0.25, nextZoom)), "custom");
    },
    [setFitMode, setTabZoom],
  );

  const handleFitWidth = useCallback(() => {
    setFitMode("fit-width");
    setTabZoom(1.0, "fit-width");
  }, [setFitMode, setTabZoom]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((v) => !v);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, [setIsSidebarOpen]);

  const handleClearPendingText = useCallback(() => {
    setPendingNoteText("");
  }, [setPendingNoteText]);

  const handleSelectItem = useCallback(
    (id: string) => {
      openInNewTab(getPaperUrl(id));
    },
    [getPaperUrl],
  );

  const sharedViewerProps = {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    onAddToNote: handleAddToNoteAndExitReadingMode,
    onAskAi: handleAskAiWithSelection,
    onAnnotate: handleAnnotateWithLock,
    annotations,
    onDeleteAnnotation: handleDeleteAnnotationProp,
    onUpdateAnnotation: handleUpdateAnnotationProp,
    fulltext,
    paper: paper || undefined,
    zoom,
    onZoomChange: handleSetCustomZoom,
    onSelectFitMode: setFitMode,
    rotation,
    themeMode,
    interactionMode,
    activeColor,
    activeTool,
    viewMode,
    fitMode,
  };

  const retractionDetails = paper?.retractionDetails as
    | { reason?: string; noticeUrl?: string }
    | undefined;

  const epubOrSnapshotInfo = useMemo(
    () =>
      resolveEpubOrSnapshot(
        paper,
        paperUrl,
        searchParams.get("attachmentId"),
        state.selectedAttachment,
      ),
    [paper, paperUrl, searchParams, state.selectedAttachment],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 1. MULTI-PAPER TAB BAR (Row 1 - Full Width Across Screen) */}
      {!isReadingMode && (
        <Topbar
          paper={paper}
          tabs={tabs}
          activeTabId={paper?.id || activeTabId}
          scopeTitle={activeScope.name}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onBack={goBack}
          onExportAnnotatedPdf={handleExportAnnotatedPdf}
        />
      )}

      {/* 2. DEDICATED READER TOOLBAR (Row 2 - Full Width Across Screen) */}
      {(paperUrl || epubOrSnapshotInfo) && (
        <ReaderToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          visiblePage={visiblePage}
          numPages={numPages}
          onNavigateToPage={handleNavigateToPageWithHistory}
          canNavigateBack={pageHistory.length > 0}
          onNavigateBack={handleNavigateBack}
          canNavigateForward={forwardHistory.length > 0}
          onNavigateForward={handleNavigateForward}
          splitMode={splitMode}
          onSelectSplitMode={handleSelectSplitMode}
          interactionMode={interactionMode}
          onSelectInteractionMode={setInteractionMode}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          activeColor={activeColor}
          onSelectColor={setActiveColor}
          isToolLocked={isToolLocked}
          onToggleToolLocked={handleToggleToolLocked}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onSetZoom={handleSetCustomZoom}
          onFitWidth={handleFitWidth}
          rotation={rotation}
          onRotate={handleRotate}
          themeMode={themeMode}
          onToggleThemeMode={handleToggleThemeMode}
          onSelectThemeMode={setThemeMode}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          fitMode={fitMode}
          onSelectFitMode={setFitMode}
          onToggleSearch={handleToggleSearch}
          isInspectorOpen={isGlobalInspectorOpen}
          onToggleInspector={handleToggleInspector}
          isScanned={isScanned}
          ocrStatus={ocrStatus}
          onTriggerOcr={handleTriggerOcr}
        />
      )}

      <ReaderRetractionBanner paper={paper} retractionDetails={retractionDetails} />

      {/* WORKSPACE VIEWPORT (Below both Topbar & ReaderToolbar: Sidebar | Canvas | Inspector | AI Companion) */}
      <div className="relative flex flex-1 min-w-0 min-h-0 w-full overflow-hidden bg-background">
        {/* 3. SIDEBAR (Activity Rail + Collapsible Resizable Panel) */}
        {!isReadingMode && isSidebarOpen && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
            onToggleOpen={handleToggleSidebar}
            currentPage={visiblePage}
            totalPages={numPages}
            onJumpToPage={handleNavigateToPageWithHistory}
            fulltext={fulltext}
            paper={paper}
            scopeId={scopeId}
            attachmentId={effectiveAttachmentId}
            pdfBlobUrl={pdfBlobUrl}
            selectedIds={selectedAnnotationIds}
            onSelectIds={setSelectedAnnotationIds}
            onToggleSelect={handleToggleSelectAnnotation}
            onBatchChangeColor={handleBatchChangeColor}
            onBatchDelete={handleBatchDelete}
            onBatchAddToNote={handleBatchAddToNote}
            annotations={annotations}
            annotationsCount={annotations.length}
            isLoadingAnnotations={isLoadingAnnotations}
            isAnnotationsError={isAnnotationsError}
            onRefetchAnnotations={refetchAnnotations}
            isUpdatingAnnotation={isUpdatingAnnotation}
            isExtractingNotes={isExtractingNotes}
            isImportingAnnotations={isImportingAnnotations}
            onImportExternalAnnotations={importExternal}
            pdfOutline={pdfOutline}
            onAddToNote={handleAddToNoteAndExitReadingMode}
            onAskAi={handleAskAiWithSelection}
            onUpdateAnnotation={handleUpdateAnnotationProp}
            onDeleteAnnotation={deleteAnnotation}
            onExtractNotes={extractNotes}
          />
        )}

        {/* 4. MAIN DOCUMENT CANVAS (PDF / EPUB / WEB SNAPSHOT) */}
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5">
              <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
              <p className="text-12 text-muted-foreground font-sans">Loading document...</p>
            </div>
          ) : !paper ? (
            <PlaneEmptyState variant="document" title="Document not found" description="The document could not be found or you do not have permission." />
          ) : epubOrSnapshotInfo ? (
            <EpubAndSnapshotViewer
              url={epubOrSnapshotInfo.url}
              mode={epubOrSnapshotInfo.mode}
              scopeId={scopeId}
              title={paper.title}
              sourceUrl={paper.url ?? undefined}
              themeMode={themeMode}
              zoom={zoom}
              activeColor={activeColor}
              targetPage={targetPage}
              onVisiblePageChange={actions.setVisiblePage}
              onAddToNote={handleAddToNoteAndExitReadingMode}
              onAskAi={handleAskAiWithSelection}
              onAnnotate={(text, pageNum, colorHex) => handleAnnotateWithLock(text, pageNum, colorHex)}
              onPageChange={(curr, total) => {
                actions.setVisiblePage(curr);
                actions.setNumPages(total);
              }}
              isSearchOpen={isSearchOpen}
              onCloseSearch={handleCloseSearch}
              initialSearchQuery={initialSearchQuery}
            />
          ) : paperUrl ? (
            splitMode === "none" ? (
              <Viewer
                {...sharedViewerProps}
                targetPage={targetPage}
                onVisiblePageChange={actions.setVisiblePage}
                onTotalPagesChange={actions.setNumPages}
                onOutlineLoad={setPdfOutline}
                isSearchOpen={isSearchOpen}
                onCloseSearch={handleCloseSearch}
                initialSearchQuery={initialSearchQuery}
              />
            ) : (
              <div className={cn("flex-1 flex min-w-0 min-h-0 overflow-hidden", splitMode === "vertical" ? "flex-row divide-x divide-border" : "flex-col divide-y divide-border")}>
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
                  <Viewer
                    {...sharedViewerProps}
                    targetPage={targetPage}
                    onVisiblePageChange={actions.setVisiblePage}
                    onTotalPagesChange={actions.setNumPages}
                    onOutlineLoad={setPdfOutline}
                    isSearchOpen={isSearchOpen}
                    onCloseSearch={handleCloseSearch}
                    initialSearchQuery={initialSearchQuery}
                  />
                </div>
                <div className="flex-1 min-w-0 min-h-0 h-full overflow-hidden relative" data-secondary-page={secondaryPage}>
                  <Viewer
                    {...sharedViewerProps}
                    targetPage={secondaryScrollRequest}
                    onVisiblePageChange={setSecondaryPage}
                    onTotalPagesChange={actions.setNumPages}
                    isSearchOpen={false}
                  />
                </div>
              </div>
            )
          ) : (
            <PlaneEmptyState
              variant="document"
              title={paper.title || "Paper Reference"}
              description="No local PDF, EPUB, or Web Snapshot attached to this entry. You can review metadata and notes in the inspector panel, or upload a PDF file."
            />
          )}
        </main>

        {/* 5. UNIFIED INSPECTOR PANEL */}
        {!isReadingMode && (
          <ReaderInspector
            item={paper} scopeId={scopeId} canEdit={canEdit}
            defaultOpen={isGlobalInspectorOpen} hideHeader={true} hideRailToggle={true}
            onClose={handleCloseInspector} onSelectItem={handleSelectItem}
            onNavigateToAnnotation={handleNavigateToPageWithHistory}
            pendingNoteText={pendingNoteText} onClearPendingText={handleClearPendingText}
          />
        )}

        {/* 6. AI COMPANION SIDEBAR (Inside Workspace Viewport — same level as Sidebar & Inspector) */}
        <ErrorBoundary fallback={null} featureName="AI Companion">
          <Suspense fallback={null}>
            <AiCompanionSidebar />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* BibTeX / RIS Export Modal */}
      {paper && bibtexOpen && (
        <BibtexModal paper={paper} open={bibtexOpen} onOpenChange={setBibtexOpen} />
      )}
    </div>
  );
}

export default ReaderPage;
