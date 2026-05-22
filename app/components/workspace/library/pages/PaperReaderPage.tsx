import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, AlertTriangle, Loader2, MessageSquare, Info } from "lucide-react";
import { useWorkspace } from "~/query/workspace";
import { useAllPapers, reindexPaper, useCollections } from "~/query/library";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { API_URL, resolveFileUrl } from "~/lib/api";
import { cn } from "~/lib/utils";
import PdfViewer from "../components/PdfViewer";
import ReaderChatPanel from "../components/ReaderChatPanel";
import { PaperDetailPanel } from "../components/PaperDetailPanel";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 550;
const MIN_METADATA_WIDTH = 260;
const MAX_METADATA_WIDTH = 500;

export default function PaperReaderPage() {
  const { workspaceId: workspaceUrl, paperId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: papers, isLoading: isLoadingPapers } = useAllPapers(workspaceId);
  const paper = papers?.find((p) => p._id === paperId) || null;

  const { data: collections } = useCollections(workspaceId);
  const collectionMap = React.useMemo(() => {
    return Object.fromEntries((collections ?? []).map((c) => [c._id, c]));
  }, [collections]);
  const paperCollection = paper?.collection ? collectionMap[paper.collection] ?? null : null;

  const [showChat, setShowChat] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [isReindexing, setIsReindexing] = useState(false);
  const [selectionContext, setSelectionContext] = useState("");

  const [chatWidth, setChatWidth] = useState(360);
  const [metadataWidth, setMetadataWidth] = useState(320);
  const [activeResize, setActiveResize] = useState<"chat" | "metadata" | null>(null);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Poll indexing status
  useEffect(() => {
    if (!paper || paper.ragStatus !== "pending") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper?.ragStatus, workspaceId, qc]);

  const handleReindex = async () => {
    if (!workspaceId || !paperId) return;
    setIsReindexing(true);
    try {
      await reindexPaper(workspaceId, paperId);
      toast.success("AI Indexing started. This may take a minute.");
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
    } catch (err) {
      console.error("Reindex failed:", err);
      toast.error("Could not trigger AI indexing.");
    } finally {
      setIsReindexing(false);
    }
  };

  const handleAskAi = (text: string) => setSelectionContext(text);
  const clearSelectionContext = () => setSelectionContext("");

  const handleChatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveResize("chat");
    startXRef.current = e.clientX;
    startWidthRef.current = chatWidth;
  };

  const handleMetadataMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveResize("metadata");
    startXRef.current = e.clientX;
    startWidthRef.current = metadataWidth;
  };

  useEffect(() => {
    if (!activeResize) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const startWidth = startWidthRef.current;

      if (activeResize === "chat") {
        const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, startWidth - deltaX));
        setChatWidth(newWidth);
      } else if (activeResize === "metadata") {
        const newWidth = Math.max(MIN_METADATA_WIDTH, Math.min(MAX_METADATA_WIDTH, startWidth - deltaX));
        setMetadataWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setActiveResize(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection & override cursor during active drag
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
    };
  }, [activeResize]);

  // ── Resolve paper URL ─────────────────────────────────────────────────────
  const paperUrl = resolveFileUrl(paper?.fileUrl) || "";

  // ── RAG status badge ──────────────────────────────────────────────────────
  const ragBadge = paper && (
    <div className="flex items-center gap-2 shrink-0">
      {paper.ragStatus === "indexed" ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1e8e3e]/10 text-[#1e8e3e] border border-[#1e8e3e]/20">
          AI Indexed
        </span>
      ) : paper.ragStatus === "pending" ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#f9ab00]/10 text-[#f9ab00] border border-[#f9ab00]/20 animate-pulse">
          Indexing…
        </span>
      ) : paper.ragStatus === "failed" ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#d93025]/10 text-[#d93025] border border-[#d93025]/20">
            Index Failed
          </span>
          <Button
            size="xs"
            variant="outline"
            className="h-6 text-[10px] py-0 px-2"
            onClick={handleReindex}
            disabled={isReindexing}
          >
            {isReindexing && <Loader2 className="size-3 animate-spin mr-1" />}
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#5f6368]/10 text-[#5f6368] border border-[#5f6368]/15">
            Not Indexed
          </span>
          <Button
            size="xs"
            variant="outline"
            className="h-6 text-[10px] py-0 px-2"
            onClick={handleReindex}
            disabled={isReindexing}
          >
            {isReindexing && <Loader2 className="size-3 animate-spin mr-1" />}
            Index Paper
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#f8f9fa] dark:bg-zinc-900"
    >
      {/* Header */}
      <header className="h-[53px] shrink-0 border-b border-[#dadce0] dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-[#f1f3f4] dark:hover:bg-zinc-800 shrink-0"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1
              className="text-[13px] font-semibold text-[#202222] dark:text-zinc-100 truncate max-w-md lg:max-w-lg"
              title={paper?.title}
            >
              {paper?.title || "Loading…"}
            </h1>
            {paper?.authors && paper.authors.length > 0 && (
              <span className="text-[10px] text-[#5f6368] dark:text-zinc-400 truncate max-w-sm">
                {paper.authors.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Controls & Badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 border border-[#dadce0] dark:border-zinc-700 rounded-lg p-0.5 bg-[#f8f9fa] dark:bg-zinc-900/50">
            <button
              onClick={() => setShowChat(!showChat)}
              className={cn(
                "h-7 px-2.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                showChat
                  ? "bg-white dark:bg-zinc-800 text-primary shadow-sm border border-[#dadce0] dark:border-zinc-700/50 font-bold"
                  : "text-muted-foreground hover:bg-[#f1f3f4] dark:hover:bg-zinc-800/40"
              )}
              title="Toggle AI Chat"
            >
              <MessageSquare className="size-3.5" />
              Chat
            </button>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className={cn(
                "h-7 px-2.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                showMetadata
                  ? "bg-white dark:bg-zinc-800 text-primary shadow-sm border border-[#dadce0] dark:border-zinc-700/50 font-bold"
                  : "text-muted-foreground hover:bg-[#f1f3f4] dark:hover:bg-zinc-800/40"
              )}
              title="Toggle Metadata"
            >
              <Info className="size-3.5" />
              Metadata
            </button>
          </div>
          {ragBadge}
        </div>
      </header>

      {/* 3-Column Layout Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-3 gap-3 bg-[#f8f9fa] dark:bg-zinc-950">
        {/* Column 1: PDF Viewer (Flexible width) */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-white dark:bg-zinc-900 border border-[#dadce0] dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          {isLoadingPapers ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#f1f3f4] dark:bg-zinc-900">
              <Loader2 className="size-6 animate-spin text-[#3370ff]/60" />
              <p className="text-xs text-[#5f6368] dark:text-zinc-400 animate-pulse">
                Loading paper…
              </p>
            </div>
          ) : paperUrl ? (
            <PdfViewer
              url={paperUrl}
              filename={paper?.filename || "paper.pdf"}
              onAskAi={handleAskAi}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6 bg-[#f1f3f4] dark:bg-zinc-900">
              <AlertTriangle className="size-8 text-[#d93025]" />
              <p className="text-sm font-semibold text-[#202222] dark:text-zinc-100">
                File Not Found
              </p>
              <p className="text-xs text-[#5f6368] dark:text-zinc-400 max-w-xs">
                The PDF file could not be located. Ensure the paper was uploaded successfully.
              </p>
            </div>
          )}
        </div>

        {/* Column 2: AI Chat Panel */}
        {showChat && (
          <div
            className="relative shrink-0 h-full"
            style={{ width: `${chatWidth}px` }}
          >
            {/* Drag Handle */}
            <div
              className={cn(
                "absolute top-0 left-[-8px] w-4 h-full cursor-col-resize z-50 group flex items-center justify-center select-none touch-none",
                activeResize === "chat" && "active-drag"
              )}
              onMouseDown={handleChatMouseDown}
            >
              <div
                className={cn(
                  "w-[2px] rounded-full transition-all duration-200 ease-out",
                  activeResize === "chat"
                    ? "h-full bg-[#3370ff]"
                    : "h-6 bg-[#dadce0] dark:bg-zinc-800 group-hover:h-full group-hover:bg-[#3370ff]"
                )}
              />
            </div>
            {/* Real Panel */}
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 border border-[#dadce0] dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              {isLoadingPapers ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#f8f9fa] dark:bg-zinc-950">
                  <Loader2 className="size-6 animate-spin text-[#3370ff]/60" />
                  <p className="text-xs text-[#5f6368] dark:text-zinc-400 animate-pulse">
                    Initializing…
                  </p>
                </div>
              ) : paper && paper.ragDocId ? (
                <ReaderChatPanel
                  ragDocId={paper.ragDocId}
                  paperTitle={paper.title}
                  selectionContext={selectionContext}
                  onClearSelectionContext={clearSelectionContext}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#f8f9fa] dark:bg-zinc-950 select-none">
                  <div className="size-10 bg-[#f9ab00]/10 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="size-5 text-[#f9ab00]" />
                  </div>
                  <h4 className="text-[13px] font-semibold text-[#202222] dark:text-zinc-100">
                    AI Indexing Required
                  </h4>
                  <p className="text-[11px] leading-relaxed text-[#5f6368] dark:text-zinc-400 max-w-xs">
                    To chat with Flux AI about this paper, it must first be indexed.
                    Click "Index Paper" in the header to start processing.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Column 3: Metadata Details Panel */}
        {showMetadata && paper && (
          <div
            className="relative shrink-0 h-full"
            style={{ width: `${metadataWidth}px` }}
          >
            {/* Drag Handle */}
            <div
              className={cn(
                "absolute top-0 left-[-8px] w-4 h-full cursor-col-resize z-50 group flex items-center justify-center select-none touch-none",
                activeResize === "metadata" && "active-drag"
              )}
              onMouseDown={handleMetadataMouseDown}
            >
              <div
                className={cn(
                  "w-[2px] rounded-full transition-all duration-200 ease-out",
                  activeResize === "metadata"
                    ? "h-full bg-[#3370ff]"
                    : "h-6 bg-[#dadce0] dark:bg-zinc-800 group-hover:h-full group-hover:bg-[#3370ff]"
                )}
              />
            </div>
            {/* Real Panel */}
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 border border-[#dadce0] dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <PaperDetailPanel
                paper={paper}
                collection={paperCollection}
                workspaceId={workspaceId}
                className="w-full border-l-0 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
