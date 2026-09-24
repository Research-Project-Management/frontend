'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle } from 'lucide-react';
import type { PageComment } from '@/features/editor/types';
import { cn } from '@/shared/lib/utils';

export interface GlyphTooltipData {
  x: number;
  bottom: number;
  comments: PageComment[];
}

export interface GlyphTooltipProps {
  tooltip: GlyphTooltipData | null;
}

export const GlyphTooltip = React.memo(function GlyphTooltip({ tooltip }: GlyphTooltipProps) {
  if (!tooltip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[9997] max-w-xs rounded-md border border-border bg-popover text-popover-foreground py-2 px-3 pointer-events-none shadow-raised-200"
      style={{ left: tooltip.x, bottom: tooltip.bottom }}
    >
      {tooltip.comments.map((c, idx) => (
        <div key={c.id}>
          {idx > 0 && <div className="my-1.5 h-px bg-border" />}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-foreground leading-tight">
              {c.author.name}
            </span>
            <span
              className={cn(
                'text-xs p-1 py-px rounded-full font-medium',
                c.status === 'resolved'
                  ? 'bg-success/15 text-success'
                  : 'bg-primary/15 text-primary',
              )}
            >
              {c.status === 'resolved' ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <Circle className="size-3.5 shrink-0" />
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-3">
            {c.content}
          </p>
          {c.replies.length > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {c.replies.length}{' '}
              {c.replies.length === 1 ? 'reply' : 'replies'}
            </p>
          )}
        </div>
      ))}
      <div className="mt-2 pt-1.5 border-t border-border/60 text-10 text-muted-foreground/80 flex items-center justify-between">
        <span>Click glyph to open review</span>
        <span className="font-mono text-10 bg-muted px-1 py-0.5 rounded-sm">Gutter</span>
      </div>
    </div>,
    document.body,
  );
});
