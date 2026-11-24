'use client';

import React from 'react';
import { BookOpen, Loader2, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  getFileCategoryMeta,
  getLibraryReadiness,
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {uploadingFiles.map((up) => {
        const isProcessing = up.stage === 'processing';
        return (
          <Tooltip key={up.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 text-11 text-foreground select-none max-w-[240px] cursor-default',
                  compact ? 'h-6 px-2' : 'h-7 px-2.5',
                )}
              >
                <Loader2
                  className="size-3 animate-spin motion-reduce:animate-none text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate max-w-[140px] font-medium">
                  {up.name}
                </span>
                {!isProcessing && (
                  <span className="text-11 text-muted-foreground font-mono shrink-0">
                    {up.progress}%
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs text-11">
              <p className="font-medium truncate">{up.name}</p>
              <p className="text-11 text-muted-foreground">
                {isProcessing
                  ? 'Processing document...'
                  : `Uploading: ${up.progress}%`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {sources.map((src) => {
        const meta = getFileCategoryMeta(src);
        const isLibrary =
          src.sourceType === 'library' || src.sourceType === 'paper';
        const IconComp = isLibrary && meta.typeLabel === 'Paper' ? BookOpen : meta.icon;
        const readiness = getLibraryReadiness(src);
        const readinessLabel =
          readiness === 'indexed'
            ? 'Ready to read'
            : readiness === 'pdf'
              ? 'PDF attached'
              : readiness === 'metadata'
                ? 'Summary & notes'
                : meta.typeLabel;
        const canToggle = Boolean(onToggleSource) && !compact;

        return (
          <div
            key={src.id}
            className={cn(
              'group relative inline-flex items-center gap-1.5 rounded-md border text-11 transition-colors select-none max-w-[260px]',
              compact ? 'h-6 px-2' : 'h-7 px-2.5',
              src.enabled
                ? 'bg-background hover:bg-muted/50 border-border text-foreground'
                : 'bg-muted/30 border-border/40 opacity-55 hover:opacity-80 text-muted-foreground',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={canToggle ? src.enabled : undefined}
                  onClick={() => canToggle && onToggleSource?.(src.id)}
                  className={cn(
                    'flex items-center gap-1.5 min-w-0 text-left rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ai',
                    canToggle ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <IconComp
                    className={cn('size-3.5 shrink-0', meta.iconClassName)}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'truncate max-w-[160px] font-medium',
                      !src.enabled && 'line-through',
                    )}
                  >
                    {src.name}
                  </span>
                  {meta.sizeText && (
                    <span className="text-11 text-muted-foreground shrink-0">
                      {meta.sizeText}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="max-w-xs text-11">
                <p className="font-medium truncate">{src.name}</p>
                <p className="text-11 text-muted-foreground">
                  {readinessLabel}
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
                  className="size-5 relative before:absolute before:-inset-2.5 md:before:hidden flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-ai"
                  aria-label={`Remove ${src.name}`}
                >
                  <X className="size-2.5" aria-hidden="true" />
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
