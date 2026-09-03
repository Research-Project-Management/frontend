'use client';

import React, { useState } from "react";
import { Check, Copy, Download, FileJson } from "lucide-react";
import { useLibraryClipboard } from "@/features/workspaces/library/hooks/library/use-clipboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { convertToBibTeX, downloadBibTeXFile } from "@/features/workspaces/library/utils/library.util";
import type { CatalogItem } from "@/features/workspaces/library/types/library.types";

export interface PaperBibtexDialogProps {
  item?: CatalogItem;
  paper?: CatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PaperBibtexDialog({
  item,
  paper: paperProp,
  open,
  onOpenChange,
}: PaperBibtexDialogProps) {
  const paper = item || paperProp || ({} as CatalogItem);
  const [copied, setCopied] = useState(false);
  const { copyToClipboard } = useLibraryClipboard();
  const bibTeXString = convertToBibTeX(paper);

  const handleCopy = () => {
    copyToClipboard(bibTeXString, "Citation copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadBibTeXFile(paper);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[540px] gap-4 bg-background border border-border shadow-none rounded-md p-6"
      >
        <DialogHeader className="gap-1">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <FileJson className="size-4.5 text-foreground" />
            Export BibTeX Citation
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Use this BibTeX entry in your LaTeX documents (e.g., in Overleaf). Double-click or copy to insert.
          </DialogDescription>
        </DialogHeader>

        {/* BibTeX Code Viewer */}
        <div className="relative group rounded-md overflow-hidden border border-border/80 bg-muted/40 shadow-none">
          {/* Header toolbar for code block */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/70 text-muted-foreground select-none">
            <span className="text-xs font-semibold font-mono text-foreground">
              BibTeX Format
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-foreground hover:text-foreground transition-colors font-medium bg-background hover:bg-muted px-2 py-0.5 rounded border border-border cursor-pointer"
                title="Copy citation"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-foreground animate-in zoom-in-50 duration-150" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-foreground" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Code display */}
          <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed select-all max-h-72 overflow-y-auto thin-scrollbar">
            <code>{bibTeXString}</code>
          </pre>
        </div>

        {/* Foot actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40 select-none">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 cursor-pointer text-foreground"
          >
            Close
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs h-9 gap-1.5 cursor-pointer text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-foreground" />
            ) : (
              <Copy className="size-3.5 text-foreground" />
            )}
            {copied ? "Copied Citation" : "Copy to Clipboard"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="text-xs h-9 gap-1.5 shadow-none cursor-pointer bg-foreground text-background hover:bg-foreground/90"
          >
            <Download className="size-3.5 text-background" />
            <span>Download .bib File</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



