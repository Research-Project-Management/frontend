'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  getFileCategoryMeta,
  type SourceEntry,
  type UploadingFile,
} from '../../context/source.port';

export interface AttachmentBarProps {
  sources: readonly SourceEntry[];
  uploadingFiles: readonly UploadingFile[];
  onRemoveSource: (id: string) => void;
  onToggleSource?: (id: string) => void;
  compact?: boolean;
}

export function AttachmentBar({
  sources,
  uploadingFiles,
  onRemoveSource,
  onToggleSource,
  compact = false,
}: AttachmentBarProps) {
  if (sources.length === 0 && uploadingFiles.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center flex-wrap',
        compact
          ? 'gap-1.5'
          : 'gap-2 px-1 pt-0.5 pb-2 border-b border-border/40 mb-1.5 max-h-40 overflow-y-auto',
      )}
    >
      {uploadingFiles.map((up) => {
        const isProcessing = up.stage === 'processing';
        return (
          <Tooltip key={up.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 text-11 text-foreground select-none max-w-[230px] cursor-default',
                  compact ? 'h-6.5 px-2' : 'px-2.5 py-1.5',
                )}
              >
                <Loader2 className="size-3 animate-spin text-ai shrink-0" />
                <span className="truncate max-w-[120px] font-medium">
                  {up.name}
                </span>
                <span className="text-10 text-muted-foreground font-mono shrink-0">
                  {isProcessing ? 'Indexing...' : `${up.progress}%`}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs text-11">
              <p className="font-medium truncate">{up.name}</p>
              <p className="text-10 text-muted-foreground">
                {isProcessing
                  ? 'Extracting content & indexing vector store...'
                  : `Uploading: ${up.progress}%`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {sources.map((src) => {
        const meta = getFileCategoryMeta(src.name, src.sourceType, src.size);
        const IconComp = meta.icon;
        const canToggle = Boolean(onToggleSource) && !compact;

        return (
          <div
            key={src.id}
            className={cn(
              'group relative inline-flex items-center gap-1.5 rounded-md border text-11 transition-colors select-none max-w-[230px]',
              compact ? 'h-6.5 px-2' : 'px-2.5 py-1.5',
              src.enabled
                ? 'bg-background hover:bg-muted/50 border-border text-foreground'
                : 'bg-muted/30 border-border/40 opacity-55 hover:opacity-80 text-muted-foreground',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => canToggle && onToggleSource?.(src.id)}
                  className={cn(
                    'flex items-center gap-1.5 min-w-0 text-left',
                    canToggle ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <IconComp className={cn('size-3 shrink-0', meta.iconClassName)} />
                  <span
                    className={cn(
                      'truncate max-w-[120px] font-medium',
                      !src.enabled && 'line-through',
                    )}
                  >
                    {src.name}
                  </span>
                  {meta.sizeText && (
                    <span className="text-10 text-muted-foreground shrink-0">
                      {meta.sizeText}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="max-w-xs text-11">
                <p className="font-medium truncate">{src.name}</p>
                <p className="text-10 text-muted-foreground">
                  {meta.typeLabel}
                  {meta.sizeText ? ` • ${meta.sizeText}` : ''}
                  {canToggle
                    ? src.enabled
                      ? ' • Click to disable'
                      : ' • Click to enable'
                    : ' • Ready for AI'}
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSource(src.id);
                  }}
                  className="size-4.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                  aria-label={`Remove ${src.name}`}
                >
                  <X className="size-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Remove document
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
