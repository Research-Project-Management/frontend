'use client';

import React from 'react';
import { ExternalLink, Minimize2 } from 'lucide-react';
import type { CompileStatus } from '@/features/editor/store';
import { PlaneEmptyState, Button } from '@/shared/components/ui';

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
    <PlaneEmptyState
      variant="detached"
      title="PDF viewer detached"
      description="Document preview is currently running in a separate window."
      action={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReattach}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Minimize2 className="size-3.5 shrink-0 opacity-70" />
            <span>Reattach to editor</span>
          </Button>
          {onFocusWindow && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFocusWindow}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              <ExternalLink className="size-3.5 shrink-0 opacity-70" />
              <span>Focus window</span>
            </Button>
          )}
        </div>
      }
    />
  );
}
