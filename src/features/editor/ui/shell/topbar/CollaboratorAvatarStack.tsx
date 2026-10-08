'use client';

/**
 * CollaboratorAvatarStack.tsx
 *
 * Real-Time Collaborator Presence Avatar Stack for Topbar (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/CollaboratorAvatarStack.tsx`
 *
 * Overleaf & Figma parity:
 * - Overlapping circular avatars with distinct collaborator colors matching cursors.
 * - Profile image or user initials with live connection pulse indicator.
 * - Rich hover tooltip displaying user details, status, active file, and cursor line/column.
 * - 1-Click jump to collaborator's active cursor/file position.
 * - Interactive `+N` overflow popover when multiple collaborators are online.
 */

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FileCode, LocateFixed, Users } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

import {
  useCollaborationPresence,
  type CollaboratorPresenceInfo,
} from '../../hooks/use-collaboration';
import { getCollaboratorColor } from '../../features/editor/CollaboratorCursors';
import { navigationCoordinator } from '../../../coordinators/navigation.coordinator';
import { editorCommandBus } from '../../../coordinators/command-bus';
import { usePageStore } from '../../../store';

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface CollaboratorAvatarStackProps {
  collaborators?: CollaboratorPresenceInfo[];
  maxVisible?: number;
  className?: string;
  onJumpToCollaborator?: (collaborator: CollaboratorPresenceInfo) => void;
}

export function CollaboratorAvatarStack({
  collaborators: propCollaborators,
  maxVisible = 3,
  className,
  onJumpToCollaborator,
}: CollaboratorAvatarStackProps) {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const storeActivePageId = usePageStore((s) => s.activePageId);
  const currentPage = usePageStore((s) => s.currentPage);
  const storeProjectId = usePageStore((s) => s.projectId);

  const pageId = storeActivePageId || currentPage?.id || params?.pageId || null;
  const rawProjectId = currentPage?.projectId || params?.projectId || storeProjectId || null;
  const projectId = typeof rawProjectId === 'string' ? rawProjectId : (rawProjectId as any)?.id || null;

  const { data: presenceData } = useCollaborationPresence(pageId, projectId);

  const collaborators = useMemo(() => {
    return propCollaborators ?? presenceData ?? [];
  }, [propCollaborators, presenceData]);

  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const overflowCollaborators = collaborators.slice(maxVisible);
  const remainingCount = overflowCollaborators.length;

  const handleJump = (c: CollaboratorPresenceInfo) => {
    if (onJumpToCollaborator) {
      onJumpToCollaborator(c);
      return;
    }

    const line = c.cursor?.line ?? 1;
    const column = c.cursor?.column ?? 1;
    const fileId = c.activeFileId;
    const filePath = c.activeFile;

    // 1. Direct navigation coordinator jump
    navigationCoordinator.jumpToLine({
      fileId,
      filePath,
      line,
      column,
      highlight: 'synctex',
    });

    // 2. Dispatch cross-pane event for editor listeners
    editorCommandBus.dispatch({
      type: 'navigation:jump-to-line',
      fileId,
      filePath,
      line,
      column,
      highlight: 'synctex',
    });
  };

  return (
    <div
      role="group"
      aria-label="Active collaborators"
      className={cn("flex items-center -space-x-1.5 p-0.5 select-none", className)}
    >
      {visibleCollaborators.map((c, index) => {
        const color = c.color || getCollaboratorColor(c.id);
        const initials = getInitials(c.name);
        const zIndex = visibleCollaborators.length - index;

        return (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleJump(c)}
                aria-label={`Collaborator ${c.name}, ${c.isOnline ? 'online' : 'idle'}${c.activeFile ? `, editing ${c.activeFile}` : ''}`}
                style={{
                  borderColor: color,
                  zIndex,
                }}
                className={cn(
                  "relative size-7 rounded-full border-2 bg-background flex items-center justify-center shrink-0 cursor-pointer outline-none transition-all duration-150 hover:scale-110 hover:z-30 focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                )}
              >
                {c.avatar ? (
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  <span
                    style={{ backgroundColor: color }}
                    className="size-full rounded-full flex items-center justify-center font-bold text-[10px] text-white tracking-wider"
                  >
                    {initials}
                  </span>
                )}

                {/* Connection Live Pulse Indicator */}
                <span
                  title={c.isOnline ? 'Online' : 'Idle'}
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-background ring-1 ring-background",
                    c.isOnline
                      ? "bg-emerald-500 animate-pulse motion-reduce:animate-none"
                      : "bg-amber-500"
                  )}
                />
              </button>
            </TooltipTrigger>

            <TooltipContent
              side="bottom"
              align="center"
              sideOffset={8}
              className="max-w-[220px] p-2.5 space-y-1.5 text-xs bg-popover text-popover-foreground shadow-md border border-border"
            >
              {/* Header: Name & Online Status */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground truncate max-w-[140px]">
                  {c.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                    c.isOnline
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {c.isOnline ? 'Online' : 'Idle'}
                </span>
              </div>

              {/* Email (if present) */}
              {c.email && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.email}
                </div>
              )}

              {/* Active Document & Cursor */}
              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] pt-0.5 border-t border-border/40">
                <FileCode className="size-3 shrink-0 text-foreground/70" />
                <span className="truncate">{c.activeFile || 'Current Document'}</span>
                {c.cursor && (
                  <span className="font-mono text-[10px] text-primary font-semibold shrink-0 ml-auto">
                    L{c.cursor.line}:C{c.cursor.column}
                  </span>
                )}
              </div>

              {/* Action Hint */}
              <div className="text-[10px] text-muted-foreground/80 italic pt-1 border-t border-border/40 flex items-center gap-1">
                <LocateFixed className="size-2.5 shrink-0 text-primary" />
                <span>Click avatar to jump to cursor</span>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Overflow `+N` Popover */}
      {remainingCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`+${remainingCount} more collaborators`}
              className="relative size-7 rounded-full border-2 border-background bg-muted hover:bg-muted/80 text-foreground font-semibold text-[10px] flex items-center justify-center shrink-0 cursor-pointer outline-none transition-transform hover:scale-105 hover:z-30 focus-visible:ring-1 focus-visible:ring-primary shadow-xs select-none"
            >
              +{remainingCount}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-72 p-3 space-y-2 text-xs shadow-lg border-border"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Users className="size-3.5 text-primary" />
                <span>Active Collaborators ({collaborators.length})</span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30">
              {collaborators.map((c) => {
                const color = c.color || getCollaboratorColor(c.id);
                const initials = getInitials(c.name);

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 pt-1.5 first:pt-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ borderColor: color }}
                        className="relative size-6 rounded-full border flex items-center justify-center shrink-0"
                      >
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <span
                            style={{ backgroundColor: color }}
                            className="size-full rounded-full flex items-center justify-center font-bold text-[9px] text-white"
                          >
                            {initials}
                          </span>
                        )}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full border border-background",
                            c.isOnline ? "bg-emerald-500" : "bg-amber-500"
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {c.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          <span className="truncate">{c.activeFile || 'Document'}</span>
                          {c.cursor && (
                            <span className="font-mono text-primary shrink-0">
                              (L{c.cursor.line})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleJump(c)}
                      aria-label={`Jump to ${c.name}`}
                      className="h-6 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10 shrink-0 gap-1"
                    >
                      <LocateFixed className="size-3" />
                      <span>Jump</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default CollaboratorAvatarStack;
