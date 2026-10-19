"use client";

import React, { useState } from "react";
import { Check, Copy, Download, FileJson } from "lucide-react";
import {
  useReaderClipboard,
  useReaderFileDownload,
} from "@/features/library/ui/reader/hooks/use-reader-feedback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { readerService } from "@/features/library/sdk/library.client";
import type { ReaderDocument } from "@/features/library/domain/types/reader.types";

export interface PaperBibtexDialogProps {
  paper: ReaderDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PaperBibtexDialog({
  paper,
  open,
  onOpenChange,
}: PaperBibtexDialogProps) {
  const [format, setFormat] = useState<"bibtex" | "ris">("bibtex");
  const [remoteContent, setRemoteContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { copy, isCopied } = useReaderClipboard();
  const { download } = useReaderFileDownload();

  React.useEffect(() => {
    if (!open || !paper?.id) {
      setRemoteContent(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    readerService.citations
      .exportLibrary(paper.projectId, {
        format,
        itemIds: [paper.id],
      })
      .then((res) => {
        if (!cancelled && res?.content) {
          setRemoteContent(res.content);
        }
      })
      .catch((err) => {
        logger.warn("Backend export failed", { error: err });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, paper?.id, paper?.projectId, format]);

  const citationKey = paper?.citationKey || paper?.id || "citation";
  const fallbackString = format === "bibtex" ? paper?.bibtex || "" : "";
  const contentString =
    remoteContent ||
    fallbackString ||
    (isLoading ? "Loading citation from server..." : "");

  const handleCopy = async () => {
    if (!contentString || isLoading) return;
    await copy(contentString, format === "bibtex" ? "BibTeX" : "RIS");
  };

  const handleDownload = () => {
    if (!contentString || isLoading) return;
    const ext = format === "bibtex" ? "bib" : "ris";
    const mime =
      format === "bibtex"
        ? "application/x-bibtex"
        : "application/x-research-info-systems";
    download(
      `${citationKey || "citation"}.${ext}`,
      contentString,
      `${mime};charset=utf-8`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border border-border bg-background shadow-raised-200 rounded-lg font-sans">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-background flex items-center justify-center text-foreground border border-border">
                <FileJson
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                  Citation Export
                </DialogTitle>
                <DialogDescription className="text-12 text-muted-foreground line-clamp-1">
                  {paper.title || "Academic reference"}
                </DialogDescription>
              </div>
            </div>

            {/* Format Toggle */}
            <div
              role="tablist"
              aria-label="Citation format"
              className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border"
            >
              <button
                type="button"
                role="tab"
                aria-selected={format === "bibtex"}
                onClick={() => setFormat("bibtex")}
                className={cn(
                  "px-2.5 py-1 text-12 font-medium rounded-sm transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  format === "bibtex"
                    ? "bg-background text-foreground font-medium border border-border-subtle shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                BibTeX
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={format === "ris"}
                onClick={() => setFormat("ris")}
                className={cn(
                  "px-2.5 py-1 text-12 font-medium rounded-sm transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  format === "ris"
                    ? "bg-background text-foreground font-medium border border-border-subtle shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                RIS
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-background">
          <div className="relative group">
            <pre className="p-3.5 bg-muted border border-border rounded-md font-mono text-11 overflow-x-auto max-h-[340px] text-foreground leading-relaxed select-all">
              {contentString}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="text-11 text-muted-foreground font-mono">
              Key: <strong className="text-foreground">@{citationKey}</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await copy(`@${citationKey}`, `@${citationKey}`);
              }}
              title="Copy Citation Key"
              aria-label="Copy citation key"
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-sm cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Copy className="size-3" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-3 text-12 font-medium gap-1.5 border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none relative before:absolute before:-inset-1 md:before:hidden"
            >
              {isCopied() ? (
                <Check
                  className="size-3.5 text-primary shrink-0"
                  strokeWidth={1.5}
                />
              ) : (
                <Copy
                  className="size-3.5 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
              )}
              <span>{isCopied() ? "Copied" : "Copy"}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-8 px-3 text-12 font-medium gap-1.5 cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Download className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Download .{format === "bibtex" ? "bib" : "ris"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
