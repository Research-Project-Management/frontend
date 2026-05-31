import { useState } from "react";
import { Check, Copy, Download, FileJson } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { convertToBibTeX, downloadBibTeXFile } from "~/lib/bibtex";
import type { Paper } from "~/types/library";

interface PaperBibtexDialogProps {
  paper: Paper;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PaperBibtexDialog({
  paper,
  open,
  onOpenChange,
}: PaperBibtexDialogProps) {
  const [copied, setCopied] = useState(false);
  const bibTeXString = convertToBibTeX(paper);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bibTeXString);
      setCopied(true);
      toast.success("Citation copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to copy citation");
    }
  };

  const handleDownload = () => {
    try {
      downloadBibTeXFile(paper);
      toast.success("BibTeX file downloaded successfully");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] gap-4 bg-background border border-border shadow-2xl rounded-xl">
        <DialogHeader className="gap-1">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileJson className="size-4.5 text-primary" />
            Export BibTeX Citation
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Use this BibTeX entry in your LaTeX documents (e.g., in Overleaf). Double-click or copy to insert.
          </DialogDescription>
        </DialogHeader>

        {/* BibTeX Code Viewer */}
        <div className="relative group rounded-lg overflow-hidden border border-border/80 bg-zinc-950 dark:bg-zinc-950/80 shadow-inner">
          {/* Header toolbar for code block */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
              BibTeX Format
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] hover:text-zinc-100 transition-colors font-medium bg-zinc-800 hover:bg-zinc-700/80 px-2 py-0.5 rounded border border-zinc-700"
                title="Copy citation"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-green-400 animate-in zoom-in-50 duration-150" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Code display */}
          <pre className="p-4 text-xs font-mono text-zinc-100 overflow-x-auto leading-relaxed select-all max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
            <code>{bibTeXString}</code>
          </pre>
        </div>

        {/* Foot actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40 select-none">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9"
          >
            Close
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs h-9 gap-1.5"
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied Citation" : "Copy to Clipboard"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="text-xs h-9 gap-1.5 shadow-sm"
          >
            <Download className="size-3.5" />
            Download .bib File
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
