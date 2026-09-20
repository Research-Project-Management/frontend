'use client';

import React from 'react';
import type { ConnectionStatus } from '@/features/editor/collaboration/yjs-socket-provider';
import { cn } from '@/shared/lib/utils';
import { Check, CloudOff, Loader2, Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';

export interface SyncStatusBadgeProps {
  connectionStatus: ConnectionStatus;
  isSynced: boolean;
  isReadOnly?: boolean;
  className?: string;
}

export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  connectionStatus,
  isSynced,
  isReadOnly = false,
  className,
}: SyncStatusBadgeProps) {
  if (isReadOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 select-none cursor-default',
              className,
            )}
          >
            <Lock className="size-3 shrink-0" />
            <span>Read Only</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          You have view-only permissions. Collaborative editing is disabled.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (connectionStatus === 'connected') {
    if (isSynced) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 select-none cursor-default',
                className,
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Saved</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            All changes saved & synced (Overleaf Realtime Engine)
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 select-none cursor-default',
              className,
            )}
          >
            <Loader2 className="size-3 shrink-0 animate-spin text-blue-500" />
            <span className="hidden sm:inline">Syncing...</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Syncing changes with collaborators...
        </TooltipContent>
      </Tooltip>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-muted/60 border border-border/40 text-muted-foreground select-none cursor-default',
              className,
            )}
          >
            <Loader2 className="size-3 shrink-0 animate-spin" />
            <span className="hidden sm:inline">Connecting...</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Connecting to realtime collaboration server...
        </TooltipContent>
      </Tooltip>
    );
  }

  // Disconnected fallback
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
            'bg-muted/40 border border-border/30 text-muted-foreground select-none cursor-default',
            className,
          )}
        >
          <CloudOff className="size-3 shrink-0" />
          <span className="hidden sm:inline">Offline (Auto-save)</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-xs">
        Realtime engine disconnected. Edits are auto-saved via HTTP fallback.
      </TooltipContent>
    </Tooltip>
  );
});
