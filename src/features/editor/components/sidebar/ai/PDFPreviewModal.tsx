'use client';

import React, { useState, useEffect } from 'react';
import { FileCode2, AlertTriangle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import type { PreviewCompileResult } from '@/features/editor/services/document.service';

export interface PDFPreviewModalProps {
  result: PreviewCompileResult;
  onClose: () => void;
  onInsert: () => void;
}

export function PDFPreviewModal({
  result,
  onClose,
  onInsert,
}: PDFPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!result.success || !result.pdf) {
      setBlobUrl(null);
      return;
    }
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.pdf, result.success]);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[820px] max-w-[92vw] h-[82vh] p-0 flex flex-col overflow-hidden gap-0"
        showCloseButton={true}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border shrink-0 space-y-0">
          <div className="flex items-center gap-2">
            <FileCode2 className="size-4 text-warning shrink-0" />
            <DialogTitle className="text-sm font-semibold">AI Suggestion Preview</DialogTitle>
            <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full ml-1">
              Isolated — does not affect your document
            </span>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex">
          {result.success && blobUrl ? (
            <object data={blobUrl} type="application/pdf" className="w-full h-full">
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <p className="text-sm">PDF viewer unavailable.</p>
                <a href={blobUrl} download="preview.pdf" className="text-xs text-primary underline">
                  Download PDF
                </a>
              </div>
            </object>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="size-6 text-destructive shrink-0" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm mb-1">Compilation failed</p>
                <p className="text-xs text-muted-foreground mb-4">The AI suggestion contains LaTeX errors</p>
                <pre className="text-xs text-destructive/80 bg-destructive/5 rounded-lg px-3 py-2 max-h-48 overflow-y-auto text-left whitespace-pre-wrap border border-destructive/20">
                  {result.log.slice(0, 1200)}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0 bg-card">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Discard
          </Button>
          {result.success && (
            <Button size="sm" onClick={onInsert} className="gap-2 text-xs font-medium">
              <Download className="size-3.5 shrink-0" />
              Insert into editor
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PDFPreviewModal;
