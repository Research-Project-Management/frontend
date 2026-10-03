'use client';

import React from 'react';
import { ExternalLink, Minimize2 } from 'lucide-react';
import type { CompileStatus } from '@/features/editor/store';

import { EditorEmptyState } from '../shared';

export interface DetachedViewerPlaceholderProps {
  onReattach: () => void;
  onFocusWindow?: () => void;
  compileStatus?: CompileStatus;
  lastCompiledAt?: Date | null;
}

export default function DetachedViewerPlaceholder({
  onReattach,
  onFocusWindow,
}: DetachedViewerPlaceholderProps) {
  return (
    <EditorEmptyState
      variant="detached"
      title="PDF viewer detached"
      description="Document preview is currently running in a separate window."
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReattach}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
          >
            <Minimize2 className="size-3.5 shrink-0 opacity-70" />
            <span>Reattach to editor</span>
          </button>
          {onFocusWindow && (
            <button
              type="button"
              onClick={onFocusWindow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
            >
              <ExternalLink className="size-3.5 shrink-0 opacity-70" />
              <span>Focus window</span>
            </button>
          )}
        </div>
      }
    />
  );
}
