'use client';

import React from 'react';
import { Check, Copy, Download, FileJson } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { convertToBibTeX, downloadBibTeXFile } from '../../utils/reader.util';
import type { ReaderDocument } from '../../types/reader.types';

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
  const { copy, isCopied } = useCopyToClipboard();
  const bibTeXString = convertToBibTeX(paper);

  const handleCopy = async () => {
    const ok = await copy(bibTeXString);
    if (ok) {
      toast.success('Citation copied to clipboard', { id: 'reader-clipboard' });
    }
  };

  const handleDownload = () => {
    downloadBibTeXFile(paper);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border border-border bg-background shadow-none">
        <DialogHeader className="p-4 pb-2 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-sm bg-muted flex items-center justify-center text-foreground border border-border">
              <FileJson className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">BibTeX Citation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {paper.title || 'Academic reference'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-muted/10">
          <div className="relative group">
            <pre className="p-3 bg-muted/40 border border-border/80 rounded-sm font-mono text-xs overflow-x-auto max-h-[340px] text-foreground leading-relaxed select-all">
              {bibTeXString}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border bg-muted/20">
          <span className="text-[11px] text-muted-foreground font-mono">
            {paper.id ? `Key: ${paper.id.slice(0, 8)}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs font-medium gap-1.5 shadow-none border-border cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            >
              {isCopied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-7 text-xs font-medium gap-1.5 shadow-none cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Download className="size-3.5" />
              <span>Download .bib</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
