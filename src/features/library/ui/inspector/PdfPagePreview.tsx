"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, FileText, Eye } from "lucide-react";
import type { Item } from "@/features/library/domain/types/library.types";

const PdfPageCanvas = dynamic(
  () => import("./PdfPageCanvas").then((m) => m.PdfPageCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 flex flex-col items-center justify-center gap-2 text-foreground">
        <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
        <span className="text-12 font-medium">Loading document engine...</span>
      </div>
    ),
  },
);

export interface PdfPagePreviewProps {
  paper: Item;
  paperUrl: string;
  scopeId?: string | null;
  previewTitle?: string;
  onOpenReader: () => void;
}

export function PdfPagePreview({
  paper,
  paperUrl,
  scopeId,
  previewTitle,
  onOpenReader,
}: PdfPagePreviewProps) {
  const [previewRequested, setPreviewRequested] = useState(false);

  useEffect(() => {
    setPreviewRequested(false);
  }, [paperUrl, paper.id]);

  return (
    <div
      onClick={onOpenReader}
      className="relative w-full rounded-md border border-border bg-background overflow-hidden shadow-none flex flex-col items-center justify-center min-h-[220px] cursor-pointer group"
    >
      {!previewRequested ? (
        <div className="h-52 w-full flex flex-col items-center justify-center gap-2.5 px-4 text-center select-none">
          <div className="size-9 rounded-md border border-border bg-muted/60 flex items-center justify-center text-muted-foreground">
            <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          </div>
          <div className="space-y-0.5 max-w-[220px]">
            <p className="text-12 font-medium text-foreground truncate">
              {previewTitle || paper.filename || paper.title || "PDF Document"}
            </p>
            <p className="text-11 text-muted-foreground">
              Click to open in Reader or load page preview
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewRequested(true);
            }}
            className="h-7 px-2.5 rounded-md border border-border bg-background text-11 font-medium text-foreground hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Eye className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span>Load Preview</span>
          </button>
        </div>
      ) : (
        <PdfPageCanvas paperUrl={paperUrl} scopeId={scopeId || paper.projectId || undefined} />
      )}
    </div>
  );
}

export default PdfPagePreview;
