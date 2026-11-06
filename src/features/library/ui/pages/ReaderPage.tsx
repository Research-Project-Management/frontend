"use client";

import { resolveEpubOrSnapshot } from "@/features/library/domain/reader.domain";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { useRouter, useSearchParams } from "next/navigation";
import { openInNewTab } from "@/features/library/core/coordinator/citation-export.coordinator";
import { cn } from "@/shared/lib/utils";
import { Loader2 } from "lucide-react";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { useReader } from "@/features/library/core/coordinator/reader/use-reader";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "@/features/library/core/store/reader.store";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useAiCompanionStore } from "@/features/ai/store/ai-companion.store";
import { useLibraryPermissions } from "@/features/library/core/coordinator/navigation.coordinator";
import { useExportAnnotatedPdf } from "@/features/library/core/coordinator/reader/use-reader";
import { ReaderInspector } from "@/features/library/ui/inspector/LibraryInspector";
import { LruTabPool } from "@/features/library/domain/reader-tab-pool.domain";
import Topbar, { ReaderRetractionBanner } from "@/features/library/ui/reader/ReaderTopbar";
import ReaderToolbar from "@/features/library/ui/reader/ReaderToolbar";
import type { AnnotationRect, ReaderNavigationTarget, PdfOutlineItem } from "@/features/library/types/reader.types";
import {
  useReaderTabHistory,
  useReaderTabPresentation,
  useReaderKeyboardShortcuts,
} from "@/features/library/core/coordinator/reader/use-reader-tabs";
import { isEditableOrModalElementFocused } from "@/features/library/core/coordinator/keyboard-shortcuts.coordinator";

const Sidebar = dynamic(() => import("@/features/library/ui/reader/ReaderSidebar"), { ssr: false });
const BibtexModal = dynamic(
  () => import("@/features/library/ui/modals/DeleteModal").then((m) => m.PaperBibtexDialog),
  { ssr: false },
);
const AiCompanionSidebar = dynamic(() => import("@/features/ai/components/companion/AiCompanionSidebar"), { ssr: false, loading: () => null });

const Viewer = dynamic(() => import("@/features/library/ui/reader/viewer/Viewer"), {
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
});

const EpubAndSnapshotViewer = dynamic<import("@/features/library/ui/reader/viewer/EpubAndSnapshotViewer").EpubAndSnapshotViewerProps>(
  () => import("@/features/library/ui/reader/viewer/EpubAndSnapshotViewer"),
  { ssr: false },
);

interface ReaderPageProps {
  paperId?: string | null;
  onBack?: () => void;
}

export function ReaderPage({ paperId, onBack }: ReaderPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearchQuery = searchParams.get("q") || searchParams.get("search") || undefined;
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const { canEditItem: canEdit } = useLibraryPermissions();
  const { state, actions } = useReader(paperId, onBack);
  const {
    scopeId, isProject, rawProjectId, isLoadingPapers, paper, paperUrl, pdfBlobUrl,
    pdfLoading, pdfError, pendingNoteText, bibtexOpen, fulltext, targetPage,
    isSidebarOpen, visiblePage, numPages, zoom, selectedAnnotationIds,
    annotations = [], isLoadingAnnotations, isAnnotationsError, isUpdatingAnnotation,
    isExtractingNotes, isImportingAnnotations, effectiveAttachmentId,
  } = state;

  const {
    setBibtexOpen, handleAddToNote, handleAnnotate, handleNavigateToPage,
    handleNavigateToAnnotation, setPendingNoteText, goBack,
    setIsSidebarOpen, setZoom, setSelectedAnnotationIds, handleToggleSelectAnnotation,
    handleBatchChangeColor, handleBatchDelete, handleBatchAddToNote,
    deleteAnnotation, updateAnnotation, extractNotes, importExternal, refetchAnnotations,
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
    tabs, activeTabId, openReader, closeTab, reorderTabs, setActiveTab, updateTabState,
    activeColor, setActiveColor, activeTool, setActiveTool,
    bookmarks, toggleBookmark,
  } = useReaderStore(
    useShallow((s) => ({
      tabs: s.tabs, activeTabId: s.activeTabId, openReader: s.openReader,
      closeTab: s.closeTab, reorderTabs: s.reorderTabs, setActiveTab: s.setActiveTab, updateTabState: s.updateTabState,
      activeColor: s.activeColor, setActiveColor: s.setActiveColor,
      activeTool: s.activeTool, setActiveTool: s.setActiveTool,
      bookmarks: s.bookmarks, toggleBookmark: s.toggleBookmark,
    })),
  );

  const effectiveTabId = paper?.id || activeTabId;
  const activeTab = tabs.find((t) => t.id === effectiveTabId);

  // Tri-State Tab Memory Pool (1 Active + 2 Standby, strictly bounded by LRU)
  const warmPoolRef = useRef<LruTabPool<{ paperId: string; title: string }>>(
    new LruTabPool<{ paperId: string; title: string }>(3),
  );

  useEffect(() => {
    if (!effectiveTabId || effectiveTabId === "library") return;
    warmPoolRef.current.put(
      effectiveTabId,
      { paperId: effectiveTabId, title: paper?.title || "Document" },
      new Set(["library", effectiveTabId]),
    );
  }, [effectiveTabId, paper?.title]);

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
  const [fallbackViewMode, setFallbackViewMode] = useState<"single" | "continuous" | "spread">(
    () => activeTab?.viewMode ?? "continuous",
  );
  const viewMode: "single" | "continuous" | "spread" = activeTab?.viewMode ?? fallbackViewMode;

  const setViewMode = useCallback(
    (next: "single" | "continuous" | "spread") => {
      setFallbackViewMode(next);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { viewMode: next });
      }
    },
    [effectiveTabId, updateTabState],
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
        if (isEditableOrModalElementFocused(e.target)) return;
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Register opened paper into tab store
  useEffect(() => {
    if (paper?.id) openReader(paper.id, paper.title || "Untitled Document");
  }, [paper?.id, paper?.title, openReader]);

  const getPaperUrl = useCallback(
    (id: string) => (isProject && rawProjectId ? `/projects/${rawProjectId}/library/papers/${id}` : `/library/papers/${id}`),
    [isProject, rawProjectId],
  );

  const handleSelectTab = useCallback(
    (id: string) => {
      if (id === "library") goBack();
      else {
        setActiveTab(id);
        router.push(getPaperUrl(id));
      }
    },
    [goBack, setActiveTab, router, getPaperUrl],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      warmPoolRef.current.delete(id);
      const closedIdx = tabs.findIndex((t) => t.id === id);
      const wasActive = activeTabId === id || (paper && paper.id === id);
      closeTab(id);
      if (wasActive) {
        const remaining = tabs.filter((t) => t.id !== id);
        const next =
          remaining[Math.min(Math.max(0, closedIdx), remaining.length - 1)] || {
            id: "library",
          };
        if (next.id === "library") goBack();
        else router.push(getPaperUrl(next.id));
      }
    },
    [tabs, activeTabId, paper, closeTab, goBack, router, getPaperUrl],
  );

  // Academic Reader States (Pan/Select, Split View, Reading Mode, Lock Tool)
  const [fallbackInteractionMode, setFallbackInteractionMode] = useState<"select" | "hand">(
    () => activeTab?.interactionMode ?? "select",
  );
  const [fallbackSplitMode, setFallbackSplitMode] = useState<"none" | "horizontal" | "vertical">(
    () => activeTab?.splitMode ?? "none",
  );
  const [fallbackSecondaryPage, setFallbackSecondaryPage] = useState<number>(
    () => activeTab?.secondaryPage ?? 1,
  );
  const interactionMode: "select" | "hand" = activeTab?.interactionMode ?? fallbackInteractionMode;
  const splitMode: "none" | "horizontal" | "vertical" = activeTab?.splitMode ?? fallbackSplitMode;
  const secondaryPage: number = activeTab?.secondaryPage ?? fallbackSecondaryPage;

  const setInteractionMode = useCallback(
    (next: "select" | "hand") => {
      setFallbackInteractionMode(next);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { interactionMode: next });
      }
    },
    [effectiveTabId, updateTabState],
  );

  const setSecondaryPage = useCallback(
    (next: number) => {
      setFallbackSecondaryPage(next);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { secondaryPage: next });
      }
    },
    [effectiveTabId, updateTabState],
  );

  useEffect(() => {
    if (effectiveTabId && effectiveTabId !== "library" && effectiveAttachmentId) {
      updateTabState(effectiveTabId, { attachmentId: effectiveAttachmentId });
    }
  }, [effectiveTabId, effectiveAttachmentId, updateTabState]);

  const [secondaryScrollRequest, setSecondaryScrollRequest] =
    useState<ReaderNavigationTarget | null>(null);
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [isToolLocked, setIsToolLocked] = useState<boolean>(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [sharedPdfDocument, setSharedPdfDocument] = useState<unknown>(null);

  useEffect(() => {
    setPdfOutline([]);
    setSharedPdfDocument(null);
  }, [paper?.id, effectiveAttachmentId]);

  const currentPaperBookmarks = useMemo(
    () => (paper?.id ? bookmarks[paper.id] ?? [] : []),
    [paper?.id, bookmarks],
  );
  const isCurrentPageBookmarked = useMemo(
    () => currentPaperBookmarks.includes(visiblePage),
    [currentPaperBookmarks, visiblePage],
  );

  const handleToggleCurrentBookmark = useCallback(() => {
    if (!paper?.id || visiblePage < 1) return;
    toggleBookmark(paper.id, visiblePage);
  }, [paper?.id, visiblePage, toggleBookmark]);

  const handleToggleBookmarkPage = useCallback(
    (page: number) => {
      if (!paper?.id || page < 1) return;
      toggleBookmark(paper.id, page);
    },
    [paper?.id, toggleBookmark],
  );

  const handleToggleReadingMode = useCallback(() => {
    setIsReadingMode((v) => !v);
  }, []);

  const handleOpenInSplitView = useCallback(
    (targetPageNum: number) => {
      const nextSplit = splitMode === "none" ? "vertical" : splitMode;
      setFallbackSplitMode(nextSplit);
      setFallbackSecondaryPage(targetPageNum);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, {
          splitMode: nextSplit,
          secondaryPage: targetPageNum,
        });
      }
      setSecondaryScrollRequest({
        pageNumber: targetPageNum,
        timestamp: Date.now(),
      });
    },
    [splitMode, effectiveTabId, updateTabState],
  );

  const handleSelectSplitMode = useCallback(
    (nextMode: "none" | "horizontal" | "vertical") => {
      setFallbackSplitMode(nextMode);
      if (splitMode === "none" && nextMode !== "none") {
        setFallbackSecondaryPage(visiblePage);
        if (effectiveTabId && effectiveTabId !== "library") {
          updateTabState(effectiveTabId, {
            splitMode: nextMode,
            secondaryPage: visiblePage,
          });
        }
        setSecondaryScrollRequest({
          pageNumber: visiblePage,
          timestamp: Date.now(),
        });
      } else if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { splitMode: nextMode });
      }
    },
    [splitMode, visiblePage, effectiveTabId, updateTabState],
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

  useReaderKeyboardShortcuts({
    activeTool: activeTool || "select",
    setActiveTool,
    setInteractionMode,
    onNavigateBack: handleNavigateBack,
    onNavigateForward: handleNavigateForward,
    onNavigatePage: handleNavigateToPageWithHistory,
    visiblePage,
    totalPages: numPages,
    setTabZoom,
    setFitMode,
    setRotation,
  });

  // Escape key exits distraction-free reading mode or resets active annotation tool to 'select'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isEditableOrModalElementFocused(e.target)) return;

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

  const handleRotate = useCallback(() => setRotation((r) => (r + 90) % 360), [setRotation]);
  const handleRotateCcw = useCallback(() => setRotation((r) => (r + 270) % 360), [setRotation]);

  const handleToggleThemeMode = useCallback(
    (mode?: "normal" | "dark" | "sepia" | "invert") => {
      if (mode) {
        setThemeMode(mode);
      } else {
        setThemeMode((m) =>
          m === "normal" ? "sepia" : m === "sepia" ? "dark" : "normal",
        );
      }
    },
    [setThemeMode],
  );

  const handleEpubPageChange = useCallback(
    (curr: number, total: number) => {
      actions.setVisiblePage(curr);
      actions.setNumPages(total);
    },
    [actions],
  );

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
      type?: "highlight" | "underline" | "note" | "text" | "rect" | "area" | "ink",
      comment?: string,
      pageLabel?: string | null,
    ) => {
      const res = await handleAnnotate(
        text,
        pageNum,
        colorHex,
        rects,
        type,
        comment,
        pageLabel,
      );
      if (!isToolLocked && activeTool !== "select") {
        setActiveTool("select");
      }
      return res;
    },
    [handleAnnotate, isToolLocked, activeTool, setActiveTool],
  );

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
      dto: {
        type?: import("@/features/library/types/reader.types").AnnotationType;
        color?: string;
        comment?: string;
        quoteText?: string;
        pageLabel?: string | null;
        tags?: string[];
        rects?: AnnotationRect[];
      },
    ) => {
      if (updateAnnotation) return updateAnnotation(id, version, dto);
      return Promise.resolve();
    },
    [updateAnnotation],
  );

  const handleToggleSidebar = useCallback(() => setIsSidebarOpen((v) => !v), [setIsSidebarOpen]);
  const handleToggleToolLocked = useCallback(() => setIsToolLocked((v) => !v), []);
  const handleZoomIn = useCallback(() => {
    setFitMode("custom");
    setTabZoom((z) => Math.min(5.0, +(z + 0.15).toFixed(2)), "custom");
  }, [setFitMode, setTabZoom]);
  const handleZoomOut = useCallback(() => {
    setFitMode("custom");
    setTabZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)), "custom");
  }, [setFitMode, setTabZoom]);
  const handleSetCustomZoom = useCallback(
    (nextZoom: number) => {
      setFitMode("custom");
      setTabZoom(Math.min(5.0, Math.max(0.25, nextZoom)), "custom");
    },
    [setFitMode, setTabZoom],
  );
  const handleFitWidth = useCallback(() => {
    setFitMode("fit-width");
    setTabZoom(1.0, "fit-width");
  }, [setFitMode, setTabZoom]);
  const handleToggleSearch = useCallback(() => setIsSearchOpen((v) => !v), []);
  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), []);
  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), [setIsSidebarOpen]);
  const handleClearPendingText = useCallback(() => setPendingNoteText(""), [setPendingNoteText]);
  const handleSelectItem = useCallback((id: string) => openInNewTab(getPaperUrl(id)), [getPaperUrl]);

  const handleScrollPositionChange = useCallback(
    (top: number) => {
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { scrollTop: top });
      }
    },
    [effectiveTabId, updateTabState],
  );

  const sharedViewerProps = useMemo(
    () => ({
      blobUrl: pdfBlobUrl, isLoading: pdfLoading, error: pdfError,
      attachmentId: effectiveAttachmentId || undefined, scopeId,
      onAddToNote: handleAddToNoteAndExitReadingMode, onAskAi: handleAskAiWithSelection,
      onAnnotate: handleAnnotateWithLock, annotations,
      onDeleteAnnotation: handleDeleteAnnotationProp, onUpdateAnnotation: handleUpdateAnnotationProp,
      fulltext, paper: paper || undefined, zoom, onZoomChange: handleSetCustomZoom,
      onSelectFitMode: setFitMode, rotation, themeMode, interactionMode, activeColor,
      activeTool, onSelectColor: setActiveColor, onSelectTool: setActiveTool,
      viewMode, fitMode, onNavigateWithHistory: handleNavigateToPageWithHistory,
      initialScrollTop: activeTab?.scrollTop,
      onScrollPositionChange: handleScrollPositionChange,
    }),
    [
      pdfBlobUrl, pdfLoading, pdfError, effectiveAttachmentId, scopeId,
      handleAddToNoteAndExitReadingMode, handleAskAiWithSelection,
      handleAnnotateWithLock, annotations, handleDeleteAnnotationProp, handleUpdateAnnotationProp,
      fulltext, paper, zoom, handleSetCustomZoom, setFitMode, rotation, themeMode, interactionMode,
      activeColor, activeTool, setActiveColor, setActiveTool,
      viewMode, fitMode, handleNavigateToPageWithHistory,
      activeTab?.scrollTop, handleScrollPositionChange,
    ],
  );

  const retractionDetails = paper?.retractionDetails as { reason?: string; noticeUrl?: string } | undefined;

  const epubOrSnapshotInfo = useMemo(
    () => resolveEpubOrSnapshot(paper, paperUrl, searchParams.get("attachmentId"), state.selectedAttachment),
    [paper, paperUrl, searchParams, state.selectedAttachment],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 1. MULTI-PAPER TAB BAR (Row 1 - Full Width Across Screen) */}
      {!isReadingMode && (
        <Topbar
          paper={paper} tabs={tabs} activeTabId={paper?.id || activeTabId}
          scopeTitle={activeScope.name} onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab} onReorderTabs={reorderTabs} onBack={goBack}
          onExportAnnotatedPdf={handleExportAnnotatedPdf}
        />
      )}

      {/* 2. DEDICATED READER TOOLBAR (Row 2 - Full Width Across Screen) */}
      {(paperUrl || epubOrSnapshotInfo) && (
        <ReaderToolbar
          isSidebarOpen={isSidebarOpen} onToggleSidebar={handleToggleSidebar}
          visiblePage={visiblePage} numPages={numPages}
          onNavigateToPage={handleNavigateToPageWithHistory}
          canNavigateBack={pageHistory.length > 0} onNavigateBack={handleNavigateBack}
          canNavigateForward={forwardHistory.length > 0} onNavigateForward={handleNavigateForward}
          splitMode={splitMode} onSelectSplitMode={handleSelectSplitMode}
          interactionMode={interactionMode} onSelectInteractionMode={setInteractionMode}
          activeTool={activeTool} onSelectTool={setActiveTool}
          activeColor={activeColor} onSelectColor={setActiveColor}
          isToolLocked={isToolLocked} onToggleToolLocked={handleToggleToolLocked}
          zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
          onSetZoom={handleSetCustomZoom} onFitWidth={handleFitWidth}
          rotation={rotation} onRotate={handleRotate} onRotateCcw={handleRotateCcw}
          themeMode={themeMode} onToggleThemeMode={handleToggleThemeMode} onSelectThemeMode={setThemeMode}
          viewMode={viewMode} onSelectViewMode={setViewMode}
          fitMode={fitMode} onSelectFitMode={setFitMode}
          onToggleSearch={handleToggleSearch} isInspectorOpen={isGlobalInspectorOpen}
          onToggleInspector={handleToggleInspector}
          isReadingMode={isReadingMode} onToggleReadingMode={handleToggleReadingMode}
        />
      )}

      <ReaderRetractionBanner paper={paper} retractionDetails={retractionDetails} />

      {/* WORKSPACE VIEWPORT (Below both Topbar & ReaderToolbar: Sidebar | Canvas | Inspector | AI Companion) */}
      <div className="relative flex flex-1 min-w-0 min-h-0 w-full overflow-hidden bg-background">
        {/* 3. SIDEBAR (Activity Rail + Collapsible Resizable Panel) */}
        {!isReadingMode && isSidebarOpen && (
          <Sidebar
            isOpen={isSidebarOpen} onClose={handleCloseSidebar} onToggleOpen={handleToggleSidebar}
            currentPage={visiblePage} totalPages={numPages} onJumpToPage={handleNavigateToPageWithHistory}
            fulltext={fulltext} paper={paper} scopeId={scopeId} attachmentId={effectiveAttachmentId}
            pdfBlobUrl={pdfBlobUrl} pdfDocument={sharedPdfDocument} bookmarkedPages={currentPaperBookmarks}
            onToggleBookmarkPage={paper?.id ? handleToggleBookmarkPage : undefined}
            selectedIds={selectedAnnotationIds} onSelectIds={setSelectedAnnotationIds}
            onToggleSelect={handleToggleSelectAnnotation} onBatchChangeColor={handleBatchChangeColor}
            onBatchDelete={handleBatchDelete} onBatchAddToNote={handleBatchAddToNote}
            annotations={annotations} annotationsCount={annotations.length}
            isLoadingAnnotations={isLoadingAnnotations} isAnnotationsError={isAnnotationsError}
            onRefetchAnnotations={refetchAnnotations} isUpdatingAnnotation={isUpdatingAnnotation}
            isExtractingNotes={isExtractingNotes} isImportingAnnotations={isImportingAnnotations}
            onImportExternalAnnotations={importExternal} pdfOutline={pdfOutline}
            onAddToNote={handleAddToNoteAndExitReadingMode} onAskAi={handleAskAiWithSelection}
            onUpdateAnnotation={handleUpdateAnnotationProp} onDeleteAnnotation={deleteAnnotation}
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
              url={epubOrSnapshotInfo.url} mode={epubOrSnapshotInfo.mode} scopeId={scopeId}
              title={paper.title} sourceUrl={paper.url ?? undefined} themeMode={themeMode}
              zoom={zoom} activeColor={activeColor} onSelectColor={setActiveColor}
              annotations={annotations} onOutlineLoad={setPdfOutline} targetPage={targetPage}
              onVisiblePageChange={actions.setVisiblePage} onAddToNote={handleAddToNoteAndExitReadingMode}
              onAskAi={handleAskAiWithSelection} onAnnotate={handleAnnotateWithLock}
              onUpdateAnnotation={handleUpdateAnnotationProp} onDeleteAnnotation={handleDeleteAnnotationProp}
              onPageChange={handleEpubPageChange} isSearchOpen={isSearchOpen}
              onCloseSearch={handleCloseSearch} initialSearchQuery={initialSearchQuery}
            />
          ) : paperUrl ? (
            splitMode === "none" ? (
              <Viewer
                {...sharedViewerProps} targetPage={targetPage}
                onVisiblePageChange={actions.setVisiblePage} onTotalPagesChange={actions.setNumPages}
                onOutlineLoad={setPdfOutline} onDocumentLoad={setSharedPdfDocument}
                onOpenInSplitView={handleOpenInSplitView} isSearchOpen={isSearchOpen}
                onCloseSearch={handleCloseSearch} initialSearchQuery={initialSearchQuery}
              />
            ) : (
              <div className={cn("flex-1 flex min-w-0 min-h-0 overflow-hidden", splitMode === "vertical" ? "flex-row divide-x divide-border" : "flex-col divide-y divide-border")}>
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
                  <Viewer
                    {...sharedViewerProps} targetPage={targetPage}
                    onVisiblePageChange={actions.setVisiblePage} onTotalPagesChange={actions.setNumPages}
                    onOutlineLoad={setPdfOutline} onDocumentLoad={setSharedPdfDocument}
                    onDocumentLoaded={setSharedPdfDocument} onOpenInSplitView={handleOpenInSplitView}
                    isSearchOpen={isSearchOpen} onCloseSearch={handleCloseSearch}
                    initialSearchQuery={initialSearchQuery}
                  />
                </div>
                <div className="flex-1 min-w-0 min-h-0 h-full overflow-hidden relative" data-secondary-page={secondaryPage}>
                  <Viewer
                    {...sharedViewerProps} sharedPdfDocument={sharedPdfDocument}
                    targetPage={secondaryScrollRequest} onVisiblePageChange={setSecondaryPage}
                    onTotalPagesChange={actions.setNumPages} onOpenInSplitView={handleOpenInSplitView}
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
