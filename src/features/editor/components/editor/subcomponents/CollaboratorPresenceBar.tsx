'use client';

import React from 'react';
import type { CollaborationPresence } from '@/features/editor/services/collaboration.service';
import { cn } from '@/shared/lib/utils';
import { Users } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';

export interface CollaboratorPresenceBarProps {
  collaborators: CollaborationPresence[];
  className?: string;
}

function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#09090b' : '#ffffff';
  }
  return '#ffffff';
}

export function CollaboratorPresenceBar({
  collaborators,
  className,
}: CollaboratorPresenceBarProps) {
  if (!collaborators || collaborators.length === 0) return null;

  const maxVisible = 4;
  const visible = collaborators.slice(0, maxVisible);
  const overflowCount = collaborators.length - maxVisible;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40 select-none',
        className,
      )}
      title={`${collaborators.length} collaborator(s) online`}
    >
      <Users className="size-3.5 text-muted-foreground ml-0.5 shrink-0" />
      <div className="flex items-center -space-x-1.5 overflow-visible">
        {visible.map((user) => {
          const initials = user.name
            ? user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : '?';
          const color = user.color || '#3b82f6';
          const textColor = getContrastTextColor(color);
          const lineStr = user.cursor?.line
            ? `Editing line ${user.cursor.line}`
            : 'Viewing document';

          return (
            <Tooltip key={user.id || user.userId || user.name} delayDuration={150}>
              <TooltipTrigger asChild>
                <div className="relative flex items-center justify-center cursor-pointer">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="size-6 rounded-full object-cover ring-2 ring-background shrink-0"
                      style={{ borderColor: color }}
                    />
                  ) : (
                    <div
                      className="size-6 rounded-full flex items-center justify-center text-11 font-bold font-mono ring-2 ring-background shrink-0 shadow-2xs"
                      style={{ backgroundColor: color, color: textColor }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="text-11 p-2 max-w-xs">
                <div className="font-medium flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-foreground">{user.name}</span>
                  {user.role && (
                    <span className="text-11 font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-foreground uppercase tracking-tight">
                      {user.role}
                    </span>
                  )}
                </div>
                <div className="text-11 font-mono text-muted-foreground mt-1">
                  {lineStr}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflowCount > 0 && (
          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-11 font-semibold font-mono text-foreground ring-2 ring-background">
            +{overflowCount}
          </div>
        )}
      </div>
    </div>
  );
}
