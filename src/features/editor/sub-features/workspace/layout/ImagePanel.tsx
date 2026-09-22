'use client';

import React from 'react';
import { FileImage, AlertCircle } from 'lucide-react';
import type { AssetInfo } from '@/features/editor/store';
import { resolveFileUrl } from '@/features/editor/utils/editor.util';

export interface ImagePanelProps {
  asset: AssetInfo;
}

export function ImagePanel({ asset }: ImagePanelProps) {
  const ext = asset.filename.split('.').pop()?.toUpperCase() ?? '';
  const sizeLabel = asset.size
    ? asset.size < 1024
      ? `${asset.size} B`
      : asset.size < 1024 * 1024
        ? `${(asset.size / 1024).toFixed(1)} KB`
        : `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0 bg-secondary/30">
        <FileImage className="size-3.5 text-primary shrink-0" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && (
          <span className="px-1.5 py-0.5 rounded-sm bg-secondary font-mono text-11 text-muted-foreground">
            {ext}
          </span>
        )}
        {sizeLabel && <span className="text-xs text-muted-foreground/70">{sizeLabel}</span>}
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-muted">
        {asset.url ? (
          <img
            src={resolveFileUrl(asset.url) || ''}
            alt={asset.filename}
            crossOrigin="use-credentials"
            className="max-w-full max-h-full object-contain rounded-md border border-border"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-6 text-muted-foreground/60 shrink-0" />
            <span className="text-sm">Image URL not available.</span>
          </div>
        )}
      </div>
    </div>
  );
}
