'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { ExternalLink, Download, Globe } from 'lucide-react';

export interface SnapshotViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotUrl: string | null;
  title: string;
  sourceUrl?: string;
}

export default function SnapshotViewerModal({
  open,
  onOpenChange,
  snapshotUrl,
  title,
  sourceUrl,
}: SnapshotViewerModalProps) {
  if (!snapshotUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = snapshotUrl;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_snapshot.html`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border rounded-lg shadow-raised-200"
      >
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between shrink-0 m-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
            <div className="size-6 rounded-md flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Globe className="size-3.5 shrink-0" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-13 font-semibold text-foreground truncate">
                {title || 'Web Snapshot Reader'}
              </DialogTitle>
              {sourceUrl && (
                <p className="text-11 text-muted-foreground truncate font-mono">
                  Source: {sourceUrl}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-12 text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                <ExternalLink className="size-3" />
                Original
              </a>
            )}
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 text-12 text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              <Download className="size-3" />
              Download HTML
            </button>
          </div>
        </DialogHeader>
        <div className="flex-1 w-full h-full min-h-0 bg-white relative">
          <iframe
            src={snapshotUrl}
            title={title}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
