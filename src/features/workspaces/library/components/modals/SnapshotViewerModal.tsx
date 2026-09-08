'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { ExternalLink, Download, Globe, X } from 'lucide-react';

interface SnapshotViewerModalProps {
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
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border rounded-lg"
      >
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between shrink-0 m-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
            <div className="size-6 rounded flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Globe className="size-3.5 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xs font-semibold text-foreground truncate">
                {title || 'Web Snapshot Reader'}
              </DialogTitle>
              {sourceUrl && (
                <p className="text-10 text-muted-foreground truncate">
                  Source: {sourceUrl}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {sourceUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-foreground"
                onClick={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')}
                title="Open original live website"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Original Web</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-foreground"
              onClick={handleDownload}
              title="Download snapshot HTML"
            >
              <Download className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Sandboxed Iframe Viewer */}
        <div className="flex-1 w-full h-full bg-background overflow-hidden relative">
          <iframe
            src={snapshotUrl}
            sandbox="allow-same-origin allow-popups"
            className="w-full h-full border-0"
            title="Sanitized Web Snapshot"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
