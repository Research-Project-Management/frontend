'use client';

/**
 * SourceVisualSwitcher.tsx
 *
 * Code vs Visual Mode Toggle Button (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/SourceVisualSwitcher.tsx`
 *
 * Segmented toggle styled with Flux Design System tokens & border radius.
 */

import React from 'react';
import { useSettingsStore } from '@/features/editor/core';
import { cn } from '@/shared/lib/utils';

export const SourceVisualSwitcher = React.memo(function SourceVisualSwitcher() {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  return (
    <div
      role="radiogroup"
      aria-label="Editor view mode"
      className="inline-flex h-7 items-center p-1 gap-1 bg-muted/70 dark:bg-muted/30 border border-border/70 rounded-md select-none shrink-0"
    >
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'code'}
        onClick={() => setEditorMode('code')}
        aria-label="Code mode"
        className={cn(
          'h-5 px-2.5 flex items-center justify-center text-xs font-medium rounded-sm transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative after:absolute after:-inset-1 after:content-[\'\']',
          editorMode === 'code'
            ? 'bg-canvas text-foreground border border-border/60 font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
        )}
      >
        Code
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'visual'}
        onClick={() => setEditorMode('visual')}
        aria-label="Visual mode"
        className={cn(
          'h-5 px-2.5 flex items-center justify-center text-xs font-medium rounded-sm transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative after:absolute after:-inset-1 after:content-[\'\']',
          editorMode === 'visual'
            ? 'bg-canvas text-foreground border border-border/60 font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
        )}
      >
        Visual
      </button>
    </div>
  );
});

export default SourceVisualSwitcher;
