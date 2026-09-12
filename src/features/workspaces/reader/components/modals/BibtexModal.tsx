'use client';

import React, { useState } from 'react';
import { Check, Copy, Download, FileJson, FileText } from 'lucide-react';
import { useCopyToClipboard } from "@/shared/hooks";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import {
  convertToBibTeX,
  downloadBibTeXFile,
  convertToRIS,
  downloadRISFile,
  generateCitationKey,
} from '../../utils/reader.util';
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
  const [format, setFormat] = useState<'bibtex' | 'ris'>('bibtex');
  const { copy, isCopied } = useCopyToClipboard();

  const citationKey = generateCitationKey(paper);
  const bibTeXString = convertToBibTeX(paper);
  const risString = convertToRIS(paper);
  const contentString = format === 'bibtex' ? bibTeXString : risString;

  const handleCopy = async () => {
    const ok = await copy(contentString);
    if (ok) {
      toast.success(`${format === 'bibtex' ? 'BibTeX' : 'RIS'} copied to clipboard`, { id: 'reader-clipboard' });
    }
  };

  const handleDownload = () => {
    if (format === 'bibtex') {
      downloadBibTeXFile(paper);
      toast.success('Downloaded .bib file', { id: 'reader-clipboard' });
    } else {
      downloadRISFile(paper);
      toast.success('Downloaded .ris file', { id: 'reader-clipboard' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border border-border bg-background shadow-none">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-muted flex items-center justify-center text-foreground border border-border">
                <FileJson className="size-4 shrink-0" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground">Citation Export</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {paper.title || 'Academic reference'}
                </DialogDescription>
              </div>
            </div>

            {/* Format Toggle */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
              <button
                type="button"
                onClick={() => setFormat('bibtex')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                  format === 'bibtex'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                BibTeX
              </button>
              <button
                type="button"
                onClick={() => setFormat('ris')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                  format === 'ris'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                RIS
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-muted/20">
          <div className="relative group">
            <pre className="p-3.5 bg-muted/70 border border-border rounded-md font-mono text-xs overflow-x-auto max-h-[340px] text-foreground leading-relaxed select-all">
              {contentString}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="text-11 text-muted-foreground font-mono">
              Key: <strong className="text-foreground">@{citationKey}</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await copy(`@${citationKey}`);
                toast.success(`Copied @${citationKey}`, { id: 'reader-clipboard' });
              }}
              title="Copy Citation Key"
              className="text-xs text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <Copy className="size-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs font-medium gap-1.5 shadow-none border-border cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            >
              {isCopied ? <Check className="size-3.5 text-primary shrink-0" /> : <Copy className="size-3.5 shrink-0" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-7 text-xs font-medium gap-1.5 shadow-none cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Download className="size-3.5 shrink-0" />
              <span>Download .{format === 'bibtex' ? 'bib' : 'ris'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

