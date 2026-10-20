"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { Loader2, ChevronLeft, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { useReader } from "@/features/library/ui/reader/hooks/use-reader";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "@/features/library/core/store/reader.store";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useOcrExtraction,
  useExportAnnotatedPdf,
} from "@/features/library/sdk/queries/reader.queries";
import { ReaderInspector } from "@/features/library/ui/inspector/ReaderInspector";
import Topbar from "@/features/library/ui/reader/ReaderTopbar";
import ReaderToolbar from "@/features/library/ui/reader/ReaderToolbar";
import type { AnnotationRect } from "@/features/library/domain/types/reader.types";

const Sidebar = dynamic(() => import("@/features/library/ui/reader/ReaderSidebar"), {
  ssr: false,
});

const BibtexModal = dynamic(
  () => import("@/features/library/ui/modals/BibtexModal"),
  {
    ssr: false,
  },
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
            <div className="h-2 w-full bg-muted rounded-sm" />
            <div className="h-2 w-full bg-muted rounded-sm" />
            <div className="h-2 w-11/12 bg-muted rounded-sm" />
            <div className="h-2 w-full bg-muted rounded-sm" />
            <div className="h-2 w-4/5 bg-muted rounded-sm" />
          </div>
        </div>
      </div>
    ),
  },
);

const EpubAndSnapshotViewer = dynamic(
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
  const { state, actions } = useReader(paperId, onBack);
  const {
    scopeId,
    projectId,
    isLoadingPapers,
    paper,
    paperUrl,
    pdfBlobUrl,
    pdfLoading,
    pdfError,
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
    setBibtexOpen,
    handleAddToNote,
    handleAnnotate,
    handleNavigateToPage,
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
  } = actions;

  // Zotero-standard URL citation jumping: ?page=X&annotation=Y
  useEffect(() => {
    const pageParam = searchParams.get("page");
    const annParam = searchParams.get("annotation") || undefined;
    if (pageParam) {
      const p = parseInt(pageParam, 10);
      if (!isNaN(p) && p >= 1) {
        actions.handleNavigateToAnnotation(p, annParam);
      }
    }
  }, [searchParams, actions]);

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
  } = useReaderStore(
    useShallow((s) => ({
      tabs: s.tabs,
      activeTabId: s.activeTabId,
      openReader: s.openReader,
      closeTab: s.closeTab,
      setActiveTab: s.setActiveTab,
      activeColor: s.activeColor,
      setActiveColor: s.setActiveColor,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
    })),
  );

  // Reader-specific local inspector toggle
  const [isReaderInspectorOpen, setIsReaderInspectorOpen] = useState(false);
  const handleToggleInspector = useCallback(() => {
    setIsReaderInspectorOpen((prev) => !prev);
  }, []);
  const handleCloseInspector = useCallback(() => {
    setIsReaderInspectorOpen(false);
  }, []);

  // In-Document Search
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(
    Boolean(initialSearchQuery),
  );

  // Page Presentation Mode (Zotero 7: Continuous Scroll, Single Page, Two Pages/Spread)
  const [viewMode, setViewMode] = useState<"single" | "continuous" | "spread">(
    "continuous",
  );
  const [fitMode, setFitMode] = useState<"fit-width" | "fit-page" | "auto">(
    "fit-width",
  );

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

  const handleSelectTab = (id: string) => {
    if (id === "library") {
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
      const next = remaining[remaining.length - 1] || { id: "library" };
      if (next.id === "library") {
        goBack();
      } else {
        router.push(`/library/papers/${next.id}`);
      }
    }
  };

  // Academic Reader States (Pan/Select, Rotation, Reading Theme, Split View, Reading Mode, Lock Tool)
  const [interactionMode, setInteractionMode] = useState<"select" | "hand">(
    "select",
  );
  const [rotation, setRotation] = useState<number>(0);
  const [themeMode, setThemeMode] = useState<"normal" | "sepia" | "dark">(
    "normal",
  );
  const [splitMode, setSplitMode] = useState<
    "none" | "horizontal" | "vertical"
  >("none");
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
  const [pageHistory, setPageHistory] = useState<number[]>([]);

  const handleNavigateToPageWithHistory = useCallback(
    (newPage: number, annotationId?: string) => {
      if (visiblePage && visiblePage !== newPage) {
        setPageHistory((prev) => [...prev.slice(-30), visiblePage]);
      }
      actions.handleNavigateToAnnotation(newPage, annotationId);
    },
    [visiblePage, actions],
  );

  const handleNavigateBack = useCallback(() => {
    if (pageHistory.length === 0) return;
    const prevPage = pageHistory[pageHistory.length - 1];
    setPageHistory((prev) => prev.slice(0, prev.length - 1));
    handleNavigateToPage(prevPage);
  }, [pageHistory, handleNavigateToPage]);

  // Escape key exits distraction-free reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReadingMode]);

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleToggleThemeMode = () => {
    setThemeMode((m) =>
      m === "normal" ? "sepia" : m === "sepia" ? "dark" : "normal",
    );
  };

  const { triggerOcr } = useOcrExtraction(scopeId);

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
  const primaryAttachment =
    paper?.attachments?.find((a) => a.id === effectiveAttachmentId) ||
    paper?.attachments?.[0];

  const attachmentMeta = primaryAttachment?.metadata as
    Record<string, unknown> | undefined;
  const paperRecord = paper as Record<string, unknown> | null;
  const paperMeta = paperRecord?.metadata as
    Record<string, unknown> | undefined;

  const isScanned = Boolean(
    attachmentMeta?.isScanned ||
    paperMeta?.isScanned ||
    (fulltext &&
      (!fulltext.sections || fulltext.sections.length === 0) &&
      (!fulltext.abstract || fulltext.abstract.length === 0) &&
      numPages > 0),
  );

  const rawExtractionStatus = (
    primaryAttachment as Record<string, unknown> | undefined
  )?.extractionStatus;
  const rawOcrStatus =
    (typeof rawExtractionStatus === "string"
      ? rawExtractionStatus.toLowerCase()
      : null) ||
    (typeof attachmentMeta?.ocrStatus === "string"
      ? attachmentMeta.ocrStatus
      : null) ||
    (typeof paperMeta?.ocrStatus === "string" ? paperMeta.ocrStatus : null) ||
    "none";

  const ocrStatus = (
    ["pending", "processing", "ready", "completed", "none"].includes(
      rawOcrStatus,
    )
      ? rawOcrStatus
      : "none"
  ) as "pending" | "processing" | "ready" | "completed" | "none";

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
      );
    } catch {
      // Handled in useExportAnnotatedPdf hook toast
    }
  }, [paper, activeTabId, exportAnnotatedPdf]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

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
      dto: { color?: string; comment?: string; tags?: string[] },
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
    setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  }, [setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)));
  }, [setZoom]);

  const handleFitWidth = useCallback(() => {
    setFitMode("fit-width");
    setZoom(1.0);
  }, [setZoom]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((v) => !v);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, [setIsSidebarOpen]);

  const handleCloseInspector = useCallback(() => {
    setIsInspectorOpen(false);
  }, [setIsInspectorOpen]);

  const handleClearPendingText = useCallback(() => {
    setPendingNoteText("");
  }, [setPendingNoteText]);

  const handleSelectItem = useCallback(
    (id: string) => {
      router.push(`/library/papers/${id}`);
    },
    [router],
  );

  const sharedViewerProps = {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    onRetry: handleRetryPdf,
    onAddToNote: handleAddToNote,
    onAnnotate: handleAnnotateWithLock,
    annotations,
    onDeleteAnnotation: handleDeleteAnnotationProp,
    onUpdateAnnotation: handleUpdateAnnotationProp,
    fulltext,
    isLoadingFulltext,
    paper: paper || undefined,
    zoom,
    rotation,
    themeMode,
    interactionMode,
    activeColor,
    activeTool,
    viewMode,
    fitMode,
  };

  const retractionDetails = paper?.retractionDetails as
    { reason?: string; noticeUrl?: string } | undefined;

  // Detect EPUB or Web Snapshot attachment when primary file is .epub / .html or when no PDF exists
  const epubOrSnapshotInfo = (() => {
    if (!paper) return null;
    type RawAttItem = {
      url?: string;
      fileUrl?: string;
      mimeType?: string;
      filename?: string;
      attachmentType?: string;
      linkMode?: string;
    };
    const rawAtts: RawAttItem[] = Array.isArray(paper.attachments)
      ? (paper.attachments as RawAttItem[])
      : [];
    const primaryMime = paper.primaryFile?.mimeType?.toLowerCase() || "";
    const primaryName = (
      paper.filename ||
      paper.primaryFile?.filename ||
      ""
    ).toLowerCase();

    if (
      primaryMime.includes("epub") ||
      primaryName.endsWith(".epub") ||
      (paperUrl && /\.epub(?:$|\?)/i.test(paperUrl))
    ) {
      return {
        mode: "epub" as const,
        url: paperUrl || paper.primaryFile?.url || "",
      };
    }

    const epubAtt = rawAtts.find(
      (a: RawAttItem) =>
        a.mimeType?.toLowerCase().includes("epub") ||
        a.filename?.toLowerCase().endsWith(".epub"),
    );
    if (epubAtt && (epubAtt.url || epubAtt.fileUrl)) {
      return {
        mode: "epub" as const,
        url: (epubAtt.fileUrl || epubAtt.url) as string,
      };
    }

    if (!paperUrl) {
      const snapshotAtt = rawAtts.find(
        (a: RawAttItem) =>
          a.attachmentType === "snapshot" ||
          a.attachmentType === "web_snapshot" ||
          a.linkMode === "imported_url" ||
          a.mimeType === "text/html" ||
          a.filename?.toLowerCase().endsWith(".html"),
      );
      if (snapshotAtt && (snapshotAtt.url || snapshotAtt.fileUrl)) {
        return {
          mode: "snapshot" as const,
          url: (snapshotAtt.fileUrl || snapshotAtt.url) as string,
        };
      }
    }

    return null;
  })();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 1. ZOTERO 7 MULTI-PAPER TAB BAR (Row 1) */}
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
          onPrint={handlePrint}
        />
      )}

      {/* 2. ZOTERO 7 DEDICATED READER TOOLBAR (Row 2) */}
      {(paperUrl || epubOrSnapshotInfo) && (
        <ReaderToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          visiblePage={visiblePage}
          numPages={numPages}
          onNavigateToPage={handleNavigateToPageWithHistory}
          canNavigateBack={pageHistory.length > 0}
          onNavigateBack={handleNavigateBack}
          splitMode={splitMode}
          onSelectSplitMode={setSplitMode}
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
          onSetZoom={setZoom}
          onFitWidth={handleFitWidth}
          rotation={rotation}
          onRotate={handleRotate}
          themeMode={themeMode}
          onToggleThemeMode={handleToggleThemeMode}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          fitMode={fitMode}
          onSelectFitMode={setFitMode}
          onToggleSearch={handleToggleSearch}
          isInspectorOpen={isReaderInspectorOpen}
          onToggleInspector={handleToggleInspector}
          isScanned={isScanned}
          ocrStatus={ocrStatus}
          onTriggerOcr={handleTriggerOcr}
        />
      )}

      {/* 2.1 RETRACTION WARNING BANNER */}
      {paper?.isRetracted && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-12 z-30 shrink-0 border-b border-destructive/20 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="size-4 shrink-0 text-destructive-foreground" />
            <span className="font-semibold tracking-normal">
              {paper.retractionNature === "expression_of_concern"
                ? "Expression of Concern"
                : paper.retractionNature === "correction"
                  ? "Publisher Correction"
                  : "Retracted Publication"}
            </span>
            <span className="text-destructive-foreground/90 truncate max-w-xl">
              -{" "}
              {retractionDetails?.reason ||
                "This publication has been flagged as retracted or unreliable."}
            </span>
          </div>
          {retractionDetails?.noticeUrl && (
            <a
              href={retractionDetails.noticeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-12 text-destructive-foreground underline font-medium hover:text-destructive-foreground/80 shrink-0 ml-4 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Notice <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* WORKSPACE VIEWPORT */}
      <div className="relative flex flex-1 min-w-0 min-h-0 w-full overflow-hidden bg-background">
        {/* 3. SIDEBAR (Activity Rail + Collapsible Resizable Panel) */}
        {!isReadingMode && (
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
            onAddToNote={handleAddToNote}
          />
        )}

        {/* 4. MAIN DOCUMENT CANVAS (PDF / EPUB / WEB SNAPSHOT) */}
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5">
              <Loader2
                className="size-5 animate-spin text-muted-foreground"
                strokeWidth={1.5}
              />
              <p className="text-12 text-muted-foreground font-sans">
                Loading document...
              </p>
            </div>
          ) : !paper ? (
            <PlaneEmptyState
              variant="document"
              title="Document not found"
              description="The document could not be found or you do not have permission."
              action={{
                label: "Return to Library",
                onClick: goBack,
                icon: ChevronLeft,
              }}
            />
          ) : epubOrSnapshotInfo ? (
            <EpubAndSnapshotViewer
              url={epubOrSnapshotInfo.url}
              mode={epubOrSnapshotInfo.mode}
              title={paper.title}
              sourceUrl={paper.url ?? undefined}
              themeMode={themeMode}
              zoom={zoom}
              activeColor={activeColor}
              onAddToNote={handleAddToNote}
              onAnnotate={(text, pageNum, colorHex) =>
                handleAnnotateWithLock(text, pageNum, colorHex)
              }
              onPageChange={(curr, total) => {
                actions.setVisiblePage(curr);
                actions.setNumPages(total);
              }}
            />
          ) : paperUrl ? (
            splitMode === "none" ? (
              <Viewer
                {...sharedViewerProps}
                targetPage={targetPage}
                onVisiblePageChange={actions.setVisiblePage}
                onTotalPagesChange={actions.setNumPages}
                isSearchOpen={isSearchOpen}
                onCloseSearch={handleCloseSearch}
                initialSearchQuery={initialSearchQuery}
              />
            ) : (
              <div
                className={cn(
                  "flex-1 flex min-w-0 min-h-0 overflow-hidden",
                  splitMode === "vertical"
                    ? "flex-row divide-x divide-border"
                    : "flex-col divide-y divide-border",
                )}
              >
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
                  <Viewer
                    {...sharedViewerProps}
                    targetPage={targetPage}
                    onVisiblePageChange={actions.setVisiblePage}
                    onTotalPagesChange={actions.setNumPages}
                    isSearchOpen={isSearchOpen}
                    onCloseSearch={handleCloseSearch}
                    initialSearchQuery={initialSearchQuery}
                  />
                </div>
                <div className="flex-1 min-w-0 min-h-0 h-full overflow-hidden relative">
                  <Viewer {...sharedViewerProps} targetPage={null} />
                </div>
              </div>
            )
          ) : (
            <PlaneEmptyState
              variant="document"
              title={paper.title || "Paper Reference"}
              description="No PDF, EPUB, or Web Snapshot attached to this entry. You can review metadata or notes using the side panel."
              action={{
                label: "Open Details",
                onClick: () => setIsReaderInspectorOpen(true),
              }}
            />
          )}
        </main>

        {/* 5. UNIFIED INSPECTOR PANEL */}
        {!isReadingMode && (
          <ReaderInspector
            item={paper}
            scopeId={scopeId}
            canEdit={true}
            defaultOpen={isReaderInspectorOpen}
            onClose={handleCloseInspector}
            onSelectItem={handleSelectItem}
            onNavigateToAnnotation={handleNavigateToPageWithHistory}
            pendingNoteText={pendingNoteText}
            onClearPendingText={handleClearPendingText}
          />
        )}
      </div>

      {/* BibTeX / RIS Export Modal */}
      {paper && bibtexOpen && (
        <BibtexModal
          paper={paper}
          open={bibtexOpen}
          onOpenChange={setBibtexOpen}
        />
      )}
    </div>
  );
}

export default ReaderPage;
