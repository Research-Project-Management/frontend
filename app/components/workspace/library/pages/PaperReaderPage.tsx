import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, AlertTriangle, Loader2 } from "lucide-react";
import { useWorkspace } from "~/query/workspace";
import { useAllPapers, reindexPaper } from "~/query/library";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { API_URL } from "~/lib/api";
import { cn } from "~/lib/utils";
import PdfViewer from "../components/PdfViewer";
import ReaderChatPanel from "../components/ReaderChatPanel";

export default function PaperReaderPage() {
  const { workspaceId: workspaceUrl, paperId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  // Fetch all papers in workspace to resolve active paper details
  const { data: papers, isLoading: isLoadingPapers } = useAllPapers(workspaceId);
  const paper = papers?.find((p) => p._id === paperId) || null;

  const [isReindexing, setIsReindexing] = useState(false);
  const [panelRatio, setPanelRatio] = useState(0.6); // default 60% PDF / 40% Chat
  const [isDragging, setIsDragging] = useState(false);
  const [selectionContext, setSelectionContext] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  // Poll indexing status if the paper is currently indexing
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
      toast.success("AI Indexing has started. This may take a minute.");
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
    } catch (err) {
      console.error("Failed to reindex paper:", err);
      toast.error("Could not trigger AI indexing.");
    } finally {
      setIsReindexing(false);
    }
  };

  const handleAskAi = (text: string) => {
    setSelectionContext(text);
  };

  const clearSelectionContext = () => {
    setSelectionContext("");
  };

  // Drag resizer mechanics
  const startDragging = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      // Constraint split panel width ratio between 25% and 75%
      const ratio = Math.max(0.25, Math.min(0.75, relativeX / rect.width));
      setPanelRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const paperUrl = paper?.fileUrl
    ? paper.fileUrl.startsWith("/api/files/")
      ? `${API_URL}${paper.fileUrl}`
      : paper.fileUrl
    : "";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-background relative",
        isDragging && "cursor-col-resize select-none"
      )}
    >
      {/* Header bar */}
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-secondary shrink-0"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1
              className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl"
              title={paper?.title}
            >
              {paper?.title || "Loading Paper..."}
            </h1>
            {paper?.authors && paper.authors.length > 0 && (
              <span className="text-[10px] text-muted-foreground truncate max-w-sm sm:max-w-md">
                By {paper.authors.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* RAG Status badges */}
        {paper && (
          <div className="flex items-center gap-2 shrink-0">
            {paper.ragStatus === "indexed" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                AI Indexed
              </span>
            ) : paper.ragStatus === "pending" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                Indexing Context...
              </span>
            ) : paper.ragStatus === "failed" ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  AI Index Failed
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6 text-[10px] py-0 px-2"
                  onClick={handleReindex}
                  disabled={isReindexing}
                >
                  {isReindexing && <Loader2 className="size-3 animate-spin mr-1" />}
                  Retry Indexing
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                  Not AI Indexed
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
        )}
      </header>

      {/* Dynamic Splits */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: PDF viewer */}
        <div style={{ width: `${panelRatio * 100}%` }} className="h-full flex min-w-0">
          {isLoadingPapers ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-50 dark:bg-zinc-900">
              <Loader2 className="size-7 animate-spin text-primary/75" />
              <p className="text-xs text-muted-foreground animate-pulse">Syncing paper details...</p>
            </div>
          ) : paperUrl ? (
            <PdfViewer url={paperUrl} filename={paper?.filename || "paper.pdf"} onAskAi={handleAskAi} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6 bg-zinc-50 dark:bg-zinc-900">
              <AlertTriangle className="size-8 text-destructive animate-bounce" />
              <p className="text-sm font-semibold text-foreground">File Link Corrupted</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                We are unable to locate the PDF file path. Ensure the paper was uploaded successfully or try uploading it again.
              </p>
            </div>
          )}
        </div>

        {/* Center Resize Splitter Handle */}
        <div
          onMouseDown={startDragging}
          className={cn(
            "w-1 h-full cursor-col-resize shrink-0 transition-colors z-20 relative",
            isDragging ? "bg-primary" : "bg-border hover:bg-primary/50"
          )}
        />

        {/* Right: AI Chat Panel */}
        <div style={{ width: `${(1 - panelRatio) * 100}%` }} className="h-full flex min-w-0">
          {isLoadingPapers ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-50 dark:bg-zinc-950 border-l border-border">
              <Loader2 className="size-7 animate-spin text-primary/75" />
              <p className="text-xs text-muted-foreground animate-pulse">Syncing AI engine...</p>
            </div>
          ) : paper && paper.ragDocId ? (
            <ReaderChatPanel
              ragDocId={paper.ragDocId}
              paperTitle={paper.title}
              selectionContext={selectionContext}
              onClearSelectionContext={clearSelectionContext}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center bg-zinc-50 dark:bg-zinc-950 border-l border-border select-none">
              <AlertTriangle className="size-8 text-amber-500 animate-pulse shrink-0" />
              <h4 className="text-xs font-semibold text-foreground">AI Context Indexing Needed</h4>
              <p className="text-[11px] leading-relaxed text-muted-foreground max-w-xs">
                To start a context-scoped RAG conversation with Flux AI, this paper must be indexed. Please click "Index Paper" in the top bar to process the file's pages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
