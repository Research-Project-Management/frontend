/**
 * ImagePanel.tsx
 *
 * Image Asset Viewer Panel inside Editor Area (Block 6: UI Features Layer).
 * Location: `features/editor/core/surface/ImagePanel.tsx`
 */

'use client';

import React from 'react';
import { FileImage, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatBytes } from '@/shared/lib/utils';
import type { AssetInfo } from '@/features/editor/domain/types/core.types';
import { useAuthorizedImageSrc } from '@/features/editor/core/hooks/useAuthorizedImageSrc';

export interface ImagePanelProps {
  asset: AssetInfo;
}

export function ImagePanel({ asset }: ImagePanelProps) {
  const authorizedSrc = useAuthorizedImageSrc(asset.url);
  const ext = asset.filename.split('.').pop()?.toUpperCase() ?? '';
  const sizeLabel = asset.size ? formatBytes(asset.size) : null;

  return (
    <div className="flex flex-col h-full w-full bg-background select-none">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0 bg-secondary/30">
        <FileImage className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && (
          <span className="px-1.5 py-0.5 rounded-sm bg-secondary font-mono text-11 text-muted-foreground">
            {ext}
          </span>
        )}
        {sizeLabel && <span className="text-xs text-muted-foreground/70">{sizeLabel}</span>}
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-muted">
        {authorizedSrc ? (
          <img
            src={authorizedSrc}
            alt={asset.filename}
            className="max-w-full max-h-full object-contain rounded-md border border-border"
          />
        ) : asset.url ? (
          <div className="w-full max-w-md aspect-[4/3] rounded-md border border-border bg-card p-6 flex flex-col items-center justify-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="h-3.5 w-36 rounded-sm" />
          </div>
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

export default ImagePanel;
